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

// ── Color Helpers (deduplicated) ─────────────────────────────────────────────

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b),
		min = Math.min(r, g, b);
	let h = 0,
		s = 0,
		l = (max + min) / 2;
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

function adjustColor(hex: string, mode: "brighten" | "darken"): string {
	let r = parseInt(hex.slice(1, 3), 16);
	let g = parseInt(hex.slice(3, 5), 16);
	let b = parseInt(hex.slice(5, 7), 16);

	if (mode === "brighten") {
		if ((r + g + b) / 3 < 128) {
			r = Math.min(255, r + 80);
			g = Math.min(255, g + 80);
			b = Math.min(255, b + 80);
			return `rgb(${r}, ${g}, ${b})`;
		}
	} else if (mode === "darken") {
		if ((r + g + b) / 3 > 128) {
			r = Math.floor(r * 0.5);
			g = Math.floor(g * 0.5);
			b = Math.floor(b * 0.5);
			return `rgb(${r}, ${g}, ${b})`;
		}
	}
	return hex;
}

async function extractVibrantColor(buffer: Buffer): Promise<string | null> {
	try {
		const image = await Jimp.read(buffer);
		const maxDim = 64;
		let w = image.bitmap.width;
		let h = image.bitmap.height;
		if (w > maxDim || h > maxDim) {
			const scale = Math.min(maxDim / w, maxDim / h);
			w = Math.floor(w * scale);
			h = Math.floor(h * scale);
			// @ts-ignore
			image.resize({ width: w, height: h });
		}

		const pixels = image.bitmap.data;
		const candidates: { h: number; s: number; l: number }[] = [];

		for (let i = 0; i < pixels.length; i += 4) {
			const r = pixels[i],
				g = pixels[i + 1],
				b = pixels[i + 2],
				a = pixels[i + 3];
			if (a < 125) continue;
			const [hVal, sVal, lVal] = rgbToHsl(r, g, b);
			if (sVal >= 0.3 && lVal >= 0.3 && lVal <= 0.8) {
				candidates.push({ h: hVal, s: sVal, l: lVal });
			}
		}

		if (!candidates.length) {
			// Relaxed criteria
			for (let i = 0; i < pixels.length; i += 4) {
				const a = pixels[i + 3];
				if (a < 10) continue;
				const [hVal, sVal, lVal] = rgbToHsl(
					pixels[i],
					pixels[i + 1],
					pixels[i + 2],
				);
				candidates.push({ h: hVal, s: sVal, l: lVal });
			}
		}

		if (!candidates.length) return null;

		candidates.sort(
			(c1, c2) =>
				c2.s - c1.s ||
				0.5 - Math.abs(c1.l - 0.5) - (0.5 - Math.abs(c2.l - 0.5)),
		);

		return hslToHex(candidates[0].h, candidates[0].s, candidates[0].l);
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
	const slugs = buildSlugs(pictureId);
	const domains = ["resources.tidal.com", "images.tidal.com"];
	const exts = [".jpg", ".webp", ".png"];
	const sizes = [
		requestedSize,
		...SUPPORTED_SIZES.filter((s) => s !== requestedSize),
	];

	// Priority: Standard JPG on primary domain
	for (const slug of slugs) {
		for (const s of sizes) {
			const dim = type === "video" ? `${s}x720` : `${s}x${s}`;
			const url = `https://${domains[0]}/images/${slug}/${dim}${exts[0]}`;
			const buffer = await fetchImageBuffer(url);
			if (buffer && buffer.length > 500) return { data: buffer, actualSize: s };
		}
	}

	// Fallback: Other domains and extensions
	for (const ext of exts.slice(1)) {
		for (const domain of domains) {
			for (const slug of slugs) {
				for (const s of sizes) {
					const dim = type === "video" ? `${s}x720` : `${s}x${s}`;
					const url = `https://${domain}/images/${slug}/${dim}${ext}`;
					const buffer = await fetchImageBuffer(url);
					if (buffer && buffer.length > 500)
						return { data: buffer, actualSize: s };
				}
			}
		}
	}
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
				const avgColor = await extractVibrantColor(buffer);
				if (avgColor) colorCache.set(cacheKey, avgColor);
			}

			reply.header("Content-Type", "image/jpeg");
			reply.header("Cache-Control", "public, max-age=31536000, immutable");
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
					color = await extractVibrantColor(result.data);
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
