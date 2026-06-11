/**
 * src/api/tidal.ts
 *
 * Proxy routes that forward requests from the Muse frontend
 * to the Tidal-API backend, adding caching and error handling.
 * Image proxy includes color extraction with deduplication.
 */

import { FastifyInstance } from "fastify";
import { hifiClient } from "../services/hifiClient.js";
import { config } from "../config.js";
import {
	searchCache,
	albumCache,
	artistCache,
	playlistCache,
	mixCache,
	trackInfoCache,
	tidalRecCache,
	streamCache,
	searchKey,
} from "../cache/tidalCache.js";
import axios from "axios";
import { Jimp } from "jimp";
import pLimit from "p-limit";
import { prisma } from "../db/prisma.js";
import { lastfmClient } from "../services/lastfmClient.js";
import { searchTidalTrack } from "../services/popularityService.js";
import { logger } from "../logger.js";

const log = logger.child({ scope: "tidal" });

// ── Quality Chain ────────────────────────────────────────────────────────────

const QUALITY_PRIORITY = [
	"HI_RES_LOSSLESS",
	"LOSSLESS",
	"HIGH",
	"LOW",
] as const;

const QUALITY_TOKENS: Record<string, string[]> = {
	HI_RES_LOSSLESS: [
		"HI_RES_LOSSLESS",
		"HIRES_LOSSLESS",
		"HIRESLOSSLESS",
		"HIFI_PLUS",
		"HI_RES_FLAC",
		"HI_RES",
		"HIRES",
		"MASTER",
		"MASTER_QUALITY",
		"MQA",
	],
	LOSSLESS: ["LOSSLESS", "HIFI"],
	HIGH: ["HIGH", "HIGH_QUALITY"],
	LOW: ["LOW", "LOW_QUALITY"],
};

function normalizeQuality(
	token: string | undefined,
): (typeof QUALITY_PRIORITY)[number] {
	if (!token) return "HI_RES_LOSSLESS";
	const upper = token
		.toUpperCase()
		.trim()
		.replace(/[^A-Z0-9]+/g, "_");
	for (const [quality, aliases] of Object.entries(QUALITY_TOKENS)) {
		if (aliases.includes(upper))
			return quality as (typeof QUALITY_PRIORITY)[number];
	}
	return "HI_RES_LOSSLESS";
}

// ── Color Cache ──────────────────────────────────────────────────────────────
const colorCache = new (await import("lru-cache")).LRUCache<string, string>({
	max: 2000,
});
const missingImageCache = new (await import("lru-cache")).LRUCache<
	string,
	true
>({
	max: 5000,
	ttl: 1000 * 60 * 15,
});

// ── Normalizers ──────────────────────────────────────────────────────────────

function normalizeTrack(raw: any) {
	if (!raw) return null;
	return {
		id: raw.id,
		title: raw.title,
		duration: raw.duration ?? 0,
		trackNumber: raw.trackNumber,
		volumeNumber: raw.volumeNumber,
		popularity: raw.popularity,
		explicit: raw.explicit ?? false,
		version: raw.version,
		url: raw.url,
		artist: raw.artist
			? {
					id: raw.artist.id,
					name: raw.artist.name,
					picture: hifiClient.tidalImageUrl(raw.artist.picture),
				}
			: raw.artists?.[0]
				? {
						id: raw.artists[0].id,
						name: raw.artists[0].name,
						picture: hifiClient.tidalImageUrl(raw.artists[0].picture),
					}
				: null,
		artists:
			raw.artists?.map((a: any) => ({
				id: a.id,
				name: a.name,
				picture: hifiClient.tidalImageUrl(a.picture),
			})) ?? [],
		album: raw.album
			? {
					id: raw.album.id,
					title: raw.album.title,
					cover: hifiClient.tidalImageUrl(raw.album.cover),
					vibrantColor: raw.album.vibrantColor,
					releaseDate: raw.album.releaseDate,
					type: raw.album.type,
				}
			: null,
		mixes: raw.mixes ?? {},
		audioQuality: raw.audioQuality,
		isrc: raw.isrc,
		bpm: raw.bpm,
		key: raw.key,
		keyScale: raw.keyScale,
		imageId: raw.imageId,
		videoCover: raw.imageId
			? hifiClient.tidalImageUrl(raw.imageId, 1280, "video")
			: null,
	};
}

function normalizeArtist(raw: any) {
	if (!raw) return null;
	return {
		id: raw.id,
		name: raw.name,
		popularity: raw.popularity,
		picture: hifiClient.tidalImageUrl(raw.picture),
		url: raw.url,
		artistTypes: raw.artistTypes,
		mixes: raw.mixes ?? {},
	};
}

function normalizeAlbum(raw: any) {
	if (!raw) return null;
	return {
		id: raw.id,
		title: raw.title,
		cover: hifiClient.tidalImageUrl(raw.cover),
		vibrantColor: raw.vibrantColor,
		releaseDate: raw.releaseDate,
		numberOfTracks: raw.numberOfTracks,
		duration: raw.duration,
		type: raw.type,
		explicit: raw.explicit,
		audioQuality: raw.audioQuality,
		url: raw.url,
		artist: raw.artist
			? {
					id: raw.artist.id,
					name: raw.artist.name,
					picture: hifiClient.tidalImageUrl(raw.artist.picture),
				}
			: raw.artists?.[0]
				? {
						id: raw.artists[0].id,
						name: raw.artists[0].name,
						picture: hifiClient.tidalImageUrl(raw.artists[0].picture),
					}
				: null,
		artists:
			raw.artists?.map((a: any) => ({
				id: a.id,
				name: a.name,
				picture: hifiClient.tidalImageUrl(a.picture),
			})) ?? [],
	};
}

function normalizePlaylist(raw: any) {
	if (!raw) return null;
	return {
		id: raw.uuid || raw.id,
		title: raw.title,
		description: raw.description,
		numberOfTracks: raw.numberOfTracks,
		duration: raw.duration,
		image: hifiClient.tidalImageUrl(
			raw.squareImage || raw.image || raw.uuid || raw.id,
		),
		url: raw.url,
	};
}

function normalizeMix(raw: any) {
	if (!raw) return null;
	const cover =
		raw.images?.LARGE?.url ||
		raw.images?.MEDIUM?.url ||
		raw.images?.SMALL?.url ||
		null;
	return {
		id: raw.id,
		title: raw.title,
		subTitle: raw.subTitle,
		description: raw.description,
		cover: hifiClient.tidalImageUrl(cover),
	};
}

function normalizeImageField(value: string | null | undefined): string | null {
	if (!value) return null;
	if (
		value.startsWith("http://") ||
		value.startsWith("https://") ||
		value.startsWith("/") ||
		value.startsWith("blob:") ||
		value.startsWith("assets/")
	) {
		return value;
	}
	return hifiClient.tidalImageUrl(value);
}

type LocalPlaylistData = {
	playlist: {
		id: string;
		title: string;
		description: string | null;
		coverUrl: string | null;
		numberOfTracks: number;
		duration: number;
	};
	tracks: any[];
};

function localTrackToRaw(row: any) {
	const artist =
		row.artist_id != null
			? {
					id: Number(row.artist_id) || row.artist_id,
					name: row.artist_name ?? "Unknown Artist",
					picture: row.artist_picture ?? null,
				}
			: null;

	const album =
		row.album_id != null
			? {
					id: Number(row.album_id) || row.album_id,
					title: row.album_title ?? "Unknown Album",
					cover: row.album_cover ?? null,
				}
			: null;

	return {
		id: Number(row.track_id) || row.track_id,
		title: row.track_title ?? "Unknown Track",
		duration: row.duration ?? 0,
		popularity: row.popularity ?? null,
		explicit: !!row.explicit,
		audioQuality: row.audio_quality ?? null,
		isrc: row.isrc ?? null,
		artist,
		artists: artist ? [artist] : [],
		album,
		mixes: {},
	};
}

/**
 * Load genre mix tracks dynamically from Last.fm API
 */
async function loadGenreMixPlaylist(
	playlistId: string,
	limit: number,
	offset: number,
): Promise<LocalPlaylistData | null> {
	// Get playlist metadata from DB
	const playlistRows = await prisma.$queryRaw<
		Array<{
			id: string;
			title: string;
			description: string | null;
			cover_url: string | null;
		}>
	>`
		SELECT p.id, p.title, p.description, p.cover_url
		 FROM playlists p
		 WHERE p.id = ${playlistId}
		 LIMIT 1`;
	const playlist = playlistRows[0];

	if (!playlist) return null;

	// Extract genre from title (e.g., "Rock Mix" -> "rock")
	const genreMatch = playlist.title.match(/^(.+?)\s+Mix$/i);
	const genre = genreMatch ? genreMatch[1] : playlist.title;

	try {
		// Fetch top tracks for this genre from Last.fm, then blend in a slice from
		// a neighbouring genre (tag.getSimilar) for variety — the exploration mix.
		const lastFmTracks = await lastfmClient.getTopTracksByTag(genre, 42);

		try {
			const neighbours = await lastfmClient.getSimilarTags(genre, 3);
			const neighbour = neighbours[0]?.name;
			if (neighbour) {
				const neighbourTracks = await lastfmClient.getTopTracksByTag(
					neighbour,
					12,
				);
				const seenKeys = new Set(
					lastFmTracks.map((t) => `${t.name}|${t.artist.name}`.toLowerCase()),
				);
				for (const t of neighbourTracks) {
					const key = `${t.name}|${t.artist.name}`.toLowerCase();
					if (seenKeys.has(key)) continue;
					seenKeys.add(key);
					lastFmTracks.push(t);
				}
			}
		} catch {
			// Variety is best-effort; the base genre tracks still stand.
		}

		if (!lastFmTracks.length) {
			log.warn({ genre }, "No tracks found for genre");
			return {
				playlist: {
					id: playlist.id,
					title: playlist.title,
					description: playlist.description,
					coverUrl: playlist.cover_url,
					numberOfTracks: 0,
					duration: 0,
				},
				tracks: [],
			};
		}

		// Map Last.fm tracks to Tidal tracks
		const tracks: any[] = [];
		let totalDuration = 0;

		// Process tracks with pagination
		const startIndex = offset;
		const endIndex = Math.min(offset + limit, lastFmTracks.length);
		const tracksToFetch = lastFmTracks.slice(startIndex, endIndex);

		for (const lfTrack of tracksToFetch) {
			try {
				const tidalTrack = await searchTidalTrack(
					lfTrack.name,
					lfTrack.artist.name,
				);

				if (tidalTrack) {
					// Convert to raw format expected by normalizeTrack
					const rawTrack = {
						id: tidalTrack.id,
						title: tidalTrack.title,
						duration: tidalTrack.duration ?? 0,
						popularity: tidalTrack.popularity ?? null,
						explicit: tidalTrack.explicit ?? false,
						audioQuality: tidalTrack.audioQuality ?? null,
						isrc: tidalTrack.isrc ?? null,
						artist: tidalTrack.artist
							? {
									id: tidalTrack.artist.id,
									name: tidalTrack.artist.name,
									picture: tidalTrack.artist.picture ?? null,
								}
							: null,
						artists:
							tidalTrack.artists?.map((a) => ({
								id: a.id,
								name: a.name,
								picture: a.picture ?? null,
							})) ?? [],
						album: tidalTrack.album
							? {
									id: tidalTrack.album.id,
									title: tidalTrack.album.title,
									cover: tidalTrack.album.cover ?? null,
								}
							: null,
						mixes: {},
					};
					tracks.push(rawTrack);
					totalDuration += rawTrack.duration;
				}
			} catch {
				// Skip tracks that fail to map
			}
		}

		return {
			playlist: {
				id: playlist.id,
				title: playlist.title,
				description: playlist.description,
				coverUrl: playlist.cover_url,
				numberOfTracks: lastFmTracks.length, // Report full count, not just fetched
				duration: totalDuration,
			},
			tracks,
		};
	} catch (error) {
		log.error({ err: error, genre }, "Failed to load genre mix");
		return {
			playlist: {
				id: playlist.id,
				title: playlist.title,
				description: playlist.description,
				coverUrl: playlist.cover_url,
				numberOfTracks: 0,
				duration: 0,
			},
			tracks: [],
		};
	}
}

async function loadLocalPlaylist(
	playlistId: string,
	limit: number,
	offset: number,
): Promise<LocalPlaylistData | null> {
	const playlistRows = await prisma.$queryRaw<
		Array<{
			id: string;
			title: string;
			description: string | null;
			cover_url: string | null;
		}>
	>`
		SELECT p.id, p.title, p.description, p.cover_url
		 FROM playlists p
		 WHERE p.id = ${playlistId}
		 LIMIT 1`;
	const playlist = playlistRows[0];

	if (!playlist) return null;

	const aggregateRows = await prisma.$queryRaw<
		Array<{ total: number; duration: number }>
	>`
		SELECT COUNT(*) as total, COALESCE(SUM(t.duration), 0) as duration
		 FROM playlist_tracks pt
		 LEFT JOIN tracks t ON t.id = pt.track_id
		 WHERE pt.playlist_id = ${playlistId}`;
	const aggregate = aggregateRows[0] ?? { total: 0, duration: 0 };

	const tracks = await prisma.$queryRaw<any[]>`
		SELECT
			pt.track_id,
			t.title as track_title,
			t.duration,
			t.popularity,
			t.explicit,
			t.audio_quality,
			t.isrc,
			t.artist_id,
			t.album_id,
			ar.name as artist_name,
			ar.picture_url as artist_picture,
			al.title as album_title,
			al.cover_url as album_cover
		FROM playlist_tracks pt
		LEFT JOIN tracks t ON t.id = pt.track_id
		LEFT JOIN artists ar ON ar.id = t.artist_id
		LEFT JOIN albums al ON al.id = t.album_id
		WHERE pt.playlist_id = ${playlistId}
		ORDER BY pt.position ASC
		LIMIT ${limit} OFFSET ${offset}`;

	return {
		playlist: {
			id: playlist.id,
			title: playlist.title,
			description: playlist.description,
			coverUrl: playlist.cover_url,
			numberOfTracks: Number(aggregate.total) || tracks.length,
			duration: Number(aggregate.duration) || 0,
		},
		tracks: tracks.map(localTrackToRaw),
	};
}

// ── Color Helpers (deduplicated) ─────────────────────────────────────────────

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b),
		min = Math.min(r, g, b);
	let h = 0,
		s = 0;
	const l = (max + min) / 2;
	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}
	return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
	let r: number, g: number, b: number;
	if (s === 0) {
		r = g = b = l;
	} else {
		const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		const p = 2 * l - q;
		const hue2rgb = (t: number) => {
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			if (t < 1 / 6) return p + (q - p) * 6 * t;
			if (t < 1 / 2) return q;
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
			return p;
		};
		r = hue2rgb(h + 1 / 3);
		g = hue2rgb(h);
		b = hue2rgb(h - 1 / 3);
	}
	const toHex = (x: number) =>
		Math.round(x * 255)
			.toString(16)
			.padStart(2, "0");
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function clamp(n: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, n));
}

function adjustColor(hex: string, mode: "brighten" | "darken"): string {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);

	const [h, s0, l0] = rgbToHsl(r, g, b);
	const s = clamp(s0 < 0.35 ? 0.45 : s0, 0.35, 0.9);
	const l =
		mode === "brighten"
			? clamp(Math.max(l0, 0.58), 0.45, 0.78)
			: clamp(Math.min(l0, 0.38), 0.2, 0.5);
	return hslToHex(h, s, l);
}

async function extractAverageColor(buffer: Buffer): Promise<string | null> {
	try {
		const image = await Jimp.read(buffer);
		image.resize({ w: 64, h: 64 });
		const { data } = image.bitmap;

		let rs = 0;
		let gs = 0;
		let bs = 0;
		let ws = 0;
		for (let i = 0; i < data.length; i += 4) {
			const alpha = data[i + 3] / 255;
			if (alpha <= 0.05) continue;
			rs += data[i] * alpha;
			gs += data[i + 1] * alpha;
			bs += data[i + 2] * alpha;
			ws += alpha;
		}
		if (ws === 0) return null;

		const r = Math.round(rs / ws);
		const g = Math.round(gs / ws);
		const b = Math.round(bs / ws);
		const [h, s0, l0] = rgbToHsl(r, g, b);

		// Make average color more vivid if it's too dull, and keep it visible on dark UI.
		const s = clamp(s0 < 0.25 ? 0.5 : s0 * 1.15, 0.35, 0.92);
		const l = clamp(l0 < 0.22 ? 0.3 : l0 > 0.78 ? 0.68 : l0, 0.24, 0.72);
		return hslToHex(h, s, l);
	} catch {
		return null;
	}
}

// ── Shared image fetching logic (deduplicated) ───────────────────────────────

const IMAGE_HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
	Referer: "https://listen.tidal.com/",
};

const SUPPORTED_SIZES = [1280, 1080, 750, 640, 480, 320, 160, 80];

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
	try {
		const res = await axios.get(url, {
			responseType: "arraybuffer",
			headers: IMAGE_HEADERS,
			timeout: 5000,
		});
		return Buffer.from(res.data);
	} catch {
		try {
			const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
			const res = await axios.get(proxyUrl, {
				responseType: "arraybuffer",
				headers: IMAGE_HEADERS,
				timeout: 5000,
			});
			return Buffer.from(res.data);
		} catch {
			return null;
		}
	}
}

function buildSlugs(pictureId: string): string[] {
	const slugSlashed = pictureId.replace(/-/g, "/");
	const slugRaw = pictureId;
	const slugDashless = pictureId.replace(/-/g, "");

	const slugs = [slugSlashed];
	if (slugRaw !== slugSlashed) slugs.push(slugRaw);
	if (slugDashless !== slugRaw && slugDashless !== slugSlashed)
		slugs.push(slugDashless);
	return slugs;
}

async function fetchTidalImage(
	pictureId: string,
	requestedSize: number,
	type: string,
): Promise<{ data: Buffer; actualSize: number } | null> {
	const missKey = `${pictureId}:${requestedSize}:${type}`;
	if (missingImageCache.has(missKey)) {
		return null;
	}

	const slugs = buildSlugs(pictureId);
	const domains = ["resources.tidal.com", "images.tidal.com"];
	const exts = [".jpg", ".webp", ".png"];
	const higherOrEqualSizes = SUPPORTED_SIZES.filter(
		(s) => s >= requestedSize,
	).sort((a, b) => b - a);
	const lowerSizes = SUPPORTED_SIZES.filter((s) => s < requestedSize).sort(
		(a, b) => b - a,
	);
	const sizes = Array.from(
		new Set([requestedSize, ...higherOrEqualSizes, ...lowerSizes]),
	);
	const limit = pLimit(8);

	const tryCandidates = async (
		candidates: Array<{ url: string; size: number }>,
	): Promise<{ data: Buffer; actualSize: number } | null> => {
		if (!candidates.length) return null;
		try {
			return await Promise.any(
				candidates.map(({ url, size }) =>
					limit(async () => {
						const buffer = await fetchImageBuffer(url);
						if (!buffer || buffer.length <= 500) {
							throw new Error("Image candidate failed");
						}
						return { data: buffer, actualSize: size };
					}),
				),
			);
		} catch {
			return null;
		}
	};

	for (const s of sizes) {
		const dim = type === "video" ? `${s}x720` : `${s}x${s}`;

		// Prefer canonical TIDAL host + JPG at each size first.
		const primaryCandidates: Array<{ url: string; size: number }> = [];
		for (const slug of slugs) {
			primaryCandidates.push({
				url: `https://${domains[0]}/images/${slug}/${dim}${exts[0]}`,
				size: s,
			});
		}
		const primary = await tryCandidates(primaryCandidates);
		if (primary) return primary;

		// Then broaden extension/domain combinations for the same size.
		const fallbackCandidates: Array<{ url: string; size: number }> = [];
		for (const ext of exts.slice(1)) {
			for (const domain of domains) {
				for (const slug of slugs) {
					fallbackCandidates.push({
						url: `https://${domain}/images/${slug}/${dim}${ext}`,
						size: s,
					});
				}
			}
		}
		const fallback = await tryCandidates(fallbackCandidates);
		if (fallback) return fallback;
	}

	missingImageCache.set(missKey, true);
	return null;
}

// ── Routes ───────────────────────────────────────────────────────────────────

export async function tidalRoutes(app: FastifyInstance) {
	// ── Image Proxy & Color Extraction ────────────────────────────────────────
	app.get<{
		Params: { pictureId: string };
		Querystring: { size?: string; type?: "square" | "video" };
	}>("/tidal/images/:pictureId", async (req, reply) => {
		const { pictureId } = req.params;
		const { size = "640", type = "square" } = req.query;
		const requestedSize = parseInt(size, 10);

		try {
			const result = await fetchTidalImage(pictureId, requestedSize, type);
			if (!result) {
				app.log.warn(`Image not found: ${pictureId}`);
				return reply.status(404).send({ error: "Image not found" });
			}

			const { data: buffer, actualSize } = result;
			const cacheKey = `${pictureId}:${type}`;

			if (!colorCache.has(cacheKey)) {
				const avgColor = await extractAverageColor(buffer);
				if (avgColor) colorCache.set(cacheKey, avgColor);
			}

			reply.header("Content-Type", "image/jpeg");
			reply.header("Cache-Control", "public, max-age=31536000, immutable");
			reply.header("X-Image-Size", String(actualSize));
			if (colorCache.has(cacheKey)) {
				reply.header("X-Extracted-Color", colorCache.get(cacheKey)!);
			}

			return buffer;
		} catch (err: any) {
			app.log.error(`Proxy failed for ${pictureId}: ${err.message}`);
			return reply.status(404).send({ error: "Image not found" });
		}
	});

	app.get<{
		Params: { pictureId: string };
		Querystring: { mode?: "brighten" | "darken"; size?: string; type?: string };
	}>("/tidal/images/:pictureId/color", async (req, reply) => {
		const { pictureId } = req.params;
		const { mode, size = "640", type = "square" } = req.query;
		const cacheKey = `${pictureId}:${type}`;

		let color: string | null | undefined = colorCache.get(cacheKey);

		if (!color) {
			try {
				const result = await fetchTidalImage(
					pictureId,
					parseInt(size, 10),
					type,
				);
				if (result) {
					color = await extractAverageColor(result.data);
					if (color) colorCache.set(cacheKey, color);
				}
			} catch {
				return { color: null };
			}
		}

		if (color && mode) {
			return { color: adjustColor(color, mode) };
		}
		return { color: color || null };
	});

	// ── Search ────────────────────────────────────────────────────────────────
	app.get<{
		Querystring: { q: string; type?: string; limit?: string; offset?: string };
	}>("/tidal/search", async (req, reply) => {
		const {
			q,
			type = "tracks",
			limit: rawLimit,
			offset: rawOffset,
		} = req.query;
		if (!q) return reply.status(400).send({ error: "query 'q' required" });

		const limit = rawLimit ? parseInt(rawLimit, 10) : 25;
		const offset = rawOffset ? parseInt(rawOffset, 10) : 0;
		const cacheK = searchKey(type, q, limit, offset);
		const cached = searchCache.get(cacheK);
		if (cached) return cached;

		try {
			let result: any;
			switch (type) {
				case "artists": {
					const raw = await hifiClient.searchArtists(q, limit, offset);
					const section = raw.artists;
					result = {
						type: "artists",
						items: (section?.items ?? []).map(normalizeArtist),
						limit: section?.limit ?? limit,
						offset: section?.offset ?? offset,
						totalNumberOfItems: section?.totalNumberOfItems ?? 0,
					};
					break;
				}
				case "albums": {
					const raw = await hifiClient.searchAlbums(q, limit, offset);
					result = {
						type: "albums",
						items: raw.items.map(normalizeAlbum),
						limit: raw.limit,
						offset: raw.offset,
						totalNumberOfItems: raw.totalNumberOfItems,
					};
					break;
				}
				case "playlists": {
					const raw = await hifiClient.searchPlaylists(q, limit, offset);
					result = {
						type: "playlists",
						items: raw.items.map(normalizePlaylist),
						limit: raw.limit,
						offset: raw.offset,
						totalNumberOfItems: raw.totalNumberOfItems,
					};
					break;
				}
				default: {
					const raw = await hifiClient.searchTracks(q, limit, offset);
					result = {
						type: "tracks",
						items: raw.items.map(normalizeTrack),
						limit: raw.limit,
						offset: raw.offset,
						totalNumberOfItems: raw.totalNumberOfItems,
					};
				}
			}
			searchCache.set(cacheK, result);
			return result;
		} catch (err: any) {
			app.log.error(err, "Tidal search failed");
			return reply.status(502).send({ error: "Tidal search failed" });
		}
	});

	// ── Unified Search ─────────────────────────────────────────────────────────
	app.get<{ Querystring: { q: string; limit?: string } }>(
		"/tidal/search/all",
		async (req, reply) => {
			const { q, limit: rawLimit } = req.query;
			if (!q) return reply.status(400).send({ error: "query 'q' required" });

			const limit = rawLimit ? parseInt(rawLimit, 10) : 10;
			const cacheK = `all:${q}:${limit}`;
			const cached = searchCache.get(cacheK);
			if (cached) return cached;

			try {
				const [tracks, artists, albums, playlists] = await Promise.all([
					hifiClient.searchTracks(q, limit, 0),
					hifiClient.searchArtists(q, limit, 0),
					hifiClient.searchAlbums(q, limit, 0),
					hifiClient.searchPlaylists(q, limit, 0),
				]);

				const result = {
					tracks: (tracks?.items ?? []).map(normalizeTrack),
					artists: (artists?.artists?.items ?? []).map(normalizeArtist),
					albums: (albums?.items ?? []).map(normalizeAlbum),
					playlists: (playlists?.items ?? []).map(normalizePlaylist),
					query: q,
				};

				searchCache.set(cacheK, result);
				return result;
			} catch (err: any) {
				app.log.error(err, "Unified search failed");
				return reply.status(502).send({ error: "Unified search failed" });
			}
		},
	);

	// ── Track / Album / Artist Detailed Fetching ───────────────────────────────
	app.get<{ Params: { trackId: string } }>(
		"/tidal/tracks/:trackId",
		async (req, reply) => {
			const { trackId } = req.params;
			const cached = trackInfoCache.get(trackId);
			if (cached) return cached;
			try {
				const raw = await hifiClient.getTrackInfo(parseInt(trackId, 10));
				const result = normalizeTrack(raw);
				if (result) trackInfoCache.set(trackId, result);
				return result ?? reply.status(404).send({ error: "Track not found" });
			} catch {
				return reply.status(502).send({ error: "Failed to fetch track info" });
			}
		},
	);

	app.get<{
		Params: { trackId: string };
		Querystring: { quality?: string };
	}>("/tidal/tracks/:trackId/stream", async (req, reply) => {
		const { trackId } = req.params;
		const ua = req.headers["user-agent"] || "";
		const isIOS =
			/iPad|iPhone|iPod/.test(ua) ||
			(ua.includes("Mac") && ua.includes("Safari") && !ua.includes("Chrome"));

		// Determine base quality
		let requestedQuality = req.query.quality;
		if (!requestedQuality && isIOS) {
			requestedQuality = "LOSSLESS";
		}

		const startQuality = normalizeQuality(requestedQuality);
		const startIndex = QUALITY_PRIORITY.indexOf(startQuality);

		let lastError: any = null;

		// Try the requested quality and fall back down the chain
		for (let i = startIndex; i < QUALITY_PRIORITY.length; i++) {
			const currentQuality = QUALITY_PRIORITY[i];
			const cacheK = `${trackId}:${currentQuality}`;
			const cached = streamCache.get(cacheK);
			if (cached) return cached;

			try {
				const raw = await hifiClient.getStreamInfo(
					parseInt(trackId, 10),
					currentQuality,
				);
				let streamUrl: string | null = null;

				// BTS manifest
				if (
					raw.manifestMimeType === "application/vnd.tidal.bts" &&
					raw.manifest
				) {
					try {
						const decoded = JSON.parse(
							Buffer.from(raw.manifest, "base64").toString("utf-8"),
						);
						streamUrl = decoded.urls?.[0] ?? null;
					} catch {
						streamUrl = null;
					}
				}

				// DASH manifest fallback
				if (!streamUrl && raw.manifest) {
					streamUrl = hifiClient.extractStreamUrlFromManifest(raw.manifest);
				}

				if (streamUrl) {
					const result = {
						trackId: raw.trackId,
						audioQuality: raw.audioQuality,
						manifestMimeType: raw.manifestMimeType,
						manifest: raw.manifest,
						streamUrl,
						bitDepth: raw.bitDepth,
						sampleRate: raw.sampleRate,
					};
					streamCache.set(cacheK, result);
					return result;
				}
			} catch (err: any) {
				lastError = err;
				app.log.warn(
					`[Stream Fallback] trackId: ${trackId}, quality: ${currentQuality} failed, trying next...`,
				);
			}
		}

		app.log.error(
			`[Stream Error] trackId: ${trackId} failed all qualities. Last error: ${lastError?.message}`,
		);
		return reply.status(502).send({
			error: "Failed to fetch stream info",
			details: lastError?.message,
		});
	});

	app.get<{ Params: { trackId: string } }>(
		"/tidal/tracks/:trackId/recommendations",
		async (req, reply) => {
			const { trackId } = req.params;
			const cached = tidalRecCache.get(trackId);
			if (cached) return cached;
			try {
				const raw = await hifiClient.getRecommendations(parseInt(trackId, 10));
				const result = {
					trackId,
					items: raw.map(normalizeTrack).filter(Boolean),
				};
				tidalRecCache.set(trackId, result);
				return result;
			} catch {
				return reply
					.status(502)
					.send({ error: "Failed to fetch recommendations" });
			}
		},
	);

	app.get<{
		Params: { albumId: string };
		Querystring: { limit?: string; offset?: string };
	}>("/tidal/albums/:albumId", async (req, reply) => {
		const { albumId } = req.params;
		const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
		const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
		const cacheK = `${albumId}:${limit}:${offset}`;
		const cached = albumCache.get(cacheK);
		if (cached) return cached;
		try {
			const raw = await hifiClient.getAlbum(
				parseInt(albumId, 10),
				limit,
				offset,
			);
			const result = {
				album: normalizeAlbum(raw.album),
				tracks: raw.tracks.map(normalizeTrack).filter(Boolean),
			};
			albumCache.set(cacheK, result);
			return result;
		} catch {
			return reply.status(502).send({ error: "Failed to fetch album" });
		}
	});

	app.get<{ Params: { artistId: string } }>(
		"/tidal/artists/:artistId",
		async (req, reply) => {
			const { artistId } = req.params;
			const cached = artistCache.get(artistId);
			if (cached) return cached;
			try {
				const [artistData, albumsData] = await Promise.all([
					hifiClient.getArtist(parseInt(artistId, 10)),
					hifiClient.getArtistAlbums(parseInt(artistId, 10), true),
				]);
				const result = {
					artist: normalizeArtist(artistData.artist),
					cover: artistData.cover,
					albums: (albumsData.albums?.items ?? []).map(normalizeAlbum),
					topTracks: albumsData.tracks.map(normalizeTrack).filter(Boolean),
				};
				artistCache.set(artistId, result);
				return result;
			} catch {
				return reply.status(502).send({ error: "Failed to fetch artist" });
			}
		},
	);

	app.get<{ Params: { artistId: string } }>(
		"/tidal/artists/:artistId/similar",
		async (req, reply) => {
			const { artistId } = req.params;
			try {
				const raw = await hifiClient.getSimilarArtists(parseInt(artistId, 10));
				return { artists: raw.map(normalizeArtist).filter(Boolean) };
			} catch {
				return reply
					.status(502)
					.send({ error: "Failed to fetch similar artists" });
			}
		},
	);

	app.get<{ Params: { albumId: string } }>(
		"/tidal/albums/:albumId/similar",
		async (req, reply) => {
			const { albumId } = req.params;
			try {
				const raw = await hifiClient.getSimilarAlbums(parseInt(albumId, 10));
				return { albums: raw.map(normalizeAlbum).filter(Boolean) };
			} catch {
				return reply
					.status(502)
					.send({ error: "Failed to fetch similar albums" });
			}
		},
	);

	app.get<{
		Params: { playlistId: string };
		Querystring: { limit?: string; offset?: string };
	}>("/tidal/playlists/:playlistId", async (req, reply) => {
		const { playlistId } = req.params;
		const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
		const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;

		// Check if this is a genre mix playlist (sys-genre-*)
		if (playlistId.startsWith("sys-genre-")) {
			const genreMix = await loadGenreMixPlaylist(playlistId, limit, offset);
			if (genreMix) {
				return {
					playlist: {
						id: genreMix.playlist.id,
						title: genreMix.playlist.title,
						description: genreMix.playlist.description ?? "",
						numberOfTracks: genreMix.playlist.numberOfTracks,
						duration: genreMix.playlist.duration,
						image: normalizeImageField(genreMix.playlist.coverUrl),
						url: null,
						creator: {
							name: "Muse",
							picture: null,
						},
					},
					tracks: genreMix.tracks.map(normalizeTrack).filter(Boolean),
				};
			}
		}

		// Regular local playlist loading
		const local = await loadLocalPlaylist(playlistId, limit, offset);
		if (local) {
			return {
				playlist: {
					id: local.playlist.id,
					title: local.playlist.title,
					description: local.playlist.description ?? "",
					numberOfTracks: local.playlist.numberOfTracks,
					duration: local.playlist.duration,
					image: normalizeImageField(local.playlist.coverUrl),
					url: null,
					creator: {
						name: "Muse",
						picture: null,
					},
				},
				tracks: local.tracks.map(normalizeTrack).filter(Boolean),
			};
		}

		// External TIDAL playlists
		const cacheK = `${playlistId}:${limit}:${offset}`;
		const cached = playlistCache.get(cacheK);
		if (cached) return cached;
		try {
			const raw = await hifiClient.getPlaylist(playlistId, limit, offset);
			const result = {
				playlist: normalizePlaylist(raw.playlist),
				tracks: raw.tracks.map(normalizeTrack).filter(Boolean),
			};
			playlistCache.set(cacheK, result);
			return result;
		} catch {
			// Fallback: Try fetching as a Mix
			try {
				const rawMix = await hifiClient.getMix(playlistId);
				const result = {
					playlist: normalizeMix(rawMix.mix),
					tracks: rawMix.tracks.map(normalizeTrack).filter(Boolean),
				};
				playlistCache.set(cacheK, result);
				return result;
			} catch {
				return reply.status(502).send({ error: "Failed to fetch playlist" });
			}
		}
	});

	app.get<{ Params: { mixId: string } }>(
		"/tidal/mixes/:mixId",
		async (req, reply) => {
			const { mixId } = req.params;

			const local = await loadLocalPlaylist(mixId, 100, 0);
			if (local) {
				return {
					mix: {
						id: mixId,
						title: local.playlist.title,
						subTitle: local.playlist.description ?? "System generated mix",
						cover: normalizeImageField(local.playlist.coverUrl),
					},
					tracks: local.tracks.map(normalizeTrack).filter(Boolean),
				};
			}

			const cached = mixCache.get(mixId);
			if (cached) return cached;
			try {
				const raw = await hifiClient.getMix(mixId);
				const result = {
					mix: normalizeMix(raw.mix),
					tracks: raw.tracks.map(normalizeTrack).filter(Boolean),
				};
				mixCache.set(mixId, result);
				return result;
			} catch {
				return reply.status(502).send({ error: "Failed to fetch mix" });
			}
		},
	);

	// ── Health Check ──────────────────────────────────────────────────────────
	app.get("/tidal/health", async (_req, reply) => {
		try {
			const { data } = await axios.get(`${config.tidalApiBaseUrl}/`);
			return { status: "ok", tidalApi: data };
		} catch {
			return reply.status(503).send({
				status: "error",
				message: "Cannot reach Tidal-API",
			});
		}
	});
}
