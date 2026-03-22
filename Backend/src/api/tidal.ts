/**
 * src/api/tidal.ts
 *
 * Proxy routes that forward requests from the Muse frontend
 * to the Tidal-API backend, adding caching and error handling.
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
import { FastAverageColor } from "fast-average-color";

// ── Color Cache ──────────────────────────────────────────────────────────────
// This stays in memory to avoid repeated heavy extraction
const colorCache = new (await import("lru-cache")).LRUCache<string, string>({
	max: 1000,
});

// Initialize FastAverageColor for the backend
const fac = new FastAverageColor();

// ── Helpers ──────────────────────────────────────────────────────────────────

function tidalImageUrl(
	pictureId: string | undefined | null,
	size = "640x640",
): string | null {
	if (!pictureId) return null;
	// Normalize ID (replace slashes with dashes for URL safety in proxy route)
	const id = pictureId.replace(/\//g, "-");
	return `${config.apiBaseUrl}/tidal/images/${id}?size=${size}`;
}

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
		audioQuality: raw.audioQuality,
		isrc: raw.isrc,
		bpm: raw.bpm,
		key: raw.key,
		version: raw.version,
		url: raw.url,
		artist: raw.artist
			? {
					id: raw.artist.id,
					name: raw.artist.name,
					picture: tidalImageUrl(raw.artist.picture),
				}
			: raw.artists?.[0]
				? {
						id: raw.artists[0].id,
						name: raw.artists[0].name,
						picture: tidalImageUrl(raw.artists[0].picture),
					}
				: null,
		artists:
			raw.artists?.map((a: any) => ({
				id: a.id,
				name: a.name,
				picture: tidalImageUrl(a.picture),
			})) ?? [],
		album: raw.album
			? {
					id: raw.album.id,
					title: raw.album.title,
					cover: tidalImageUrl(raw.album.cover),
					vibrantColor: raw.album.vibrantColor,
					releaseDate: raw.album.releaseDate,
				}
			: null,
		mixes: raw.mixes ?? {},
	};
}

function normalizeArtist(raw: any) {
	if (!raw) return null;
	return {
		id: raw.id,
		name: raw.name,
		popularity: raw.popularity,
		picture: tidalImageUrl(raw.picture),
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
		cover: tidalImageUrl(raw.cover),
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
					picture: tidalImageUrl(raw.artist.picture),
				}
			: raw.artists?.[0]
				? {
						id: raw.artists[0].id,
						name: raw.artists[0].name,
						picture: tidalImageUrl(raw.artists[0].picture),
					}
				: null,
		artists:
			raw.artists?.map((a: any) => ({
				id: a.id,
				name: a.name,
				picture: tidalImageUrl(a.picture),
			})) ?? [],
	};
}

// ── Color Extraction ─────────────────────────────────────────────────────────

async function getAverageColorManual(buffer: Buffer): Promise<string | null> {
	try {
		const image = await Jimp.read(buffer);
		// @ts-ignore - modern jimp resize signature
		image.resize({ width: 64 });

		const color = fac.getColor(image.bitmap.data as any, {
			algorithm: "dominant",
			width: image.bitmap.width,
			height: image.bitmap.height,
		});

		return color.hex;
	} catch (err) {
		return null;
	}
}

// ── Routes ───────────────────────────────────────────────────────────────────

export async function tidalRoutes(app: FastifyInstance) {
	// ── Image Proxy & Color Extraction ────────────────────────────────────────
	app.get<{
		Params: { pictureId: string };
		Querystring: { size?: string };
	}>("/tidal/images/:pictureId", async (req, reply) => {
		const { pictureId } = req.params;
		const size = req.query.size ?? "640x640";

		const slug = pictureId.replace(/-/g, "/");
		const tidalUrl = `https://resources.tidal.com/images/${slug}/${size}.jpg`;

		try {
			const response = await axios.get(tidalUrl, {
				responseType: "arraybuffer",
			});

			const cacheKey = `${pictureId}:${size}`;
			if (!colorCache.has(cacheKey)) {
				const avgColor = await getAverageColorManual(
					Buffer.from(response.data),
				);
				if (avgColor) {
					colorCache.set(cacheKey, avgColor);
				}
			}

			reply.header("Content-Type", "image/jpeg");
			reply.header("Cache-Control", "public, max-age=31536000, immutable");
			if (colorCache.has(cacheKey)) {
				reply.header("X-Extracted-Color", colorCache.get(cacheKey)!);
			}

			return Buffer.from(response.data);
		} catch (err: any) {
			app.log.error(`Proxy failed for ${tidalUrl}: ${err.message}`);
			return reply.status(404).send({ error: "Image not found" });
		}
	});

	app.get<{ Params: { pictureId: string } }>(
		"/tidal/images/:pictureId/color",
		async (req, reply) => {
			const { pictureId } = req.params;
			const cacheKey = `${pictureId}:640x640`;
			return { color: colorCache.get(cacheKey) || null };
		},
	);

	// ── Search ────────────────────────────────────────────────────────────────

	app.get<{
		Querystring: {
			q: string;
			type?: string;
			limit?: string;
			offset?: string;
		};
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
						items: raw.items,
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

	app.get<{
		Querystring: { q: string; limit?: string };
	}>("/tidal/search/all", async (req, reply) => {
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
				playlists: playlists?.items ?? [],
				query: q,
			};

			searchCache.set(cacheK, result);
			return result;
		} catch (err: any) {
			app.log.error(err, "Unified search failed");
			return reply.status(502).send({ error: "Unified search failed" });
		}
	});

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
			} catch (err: any) {
				return reply.status(502).send({ error: "Failed to fetch track info" });
			}
		},
	);

	app.get<{
		Params: { trackId: string };
		Querystring: { quality?: string };
	}>("/tidal/tracks/:trackId/stream", async (req, reply) => {
		const { trackId } = req.params;
		const quality = req.query.quality ?? "LOSSLESS";
		const cacheK = `${trackId}:${quality}`;
		const cached = streamCache.get(cacheK);
		if (cached) return cached;
		try {
			const raw = await hifiClient.getStreamInfo(
				parseInt(trackId, 10),
				quality,
			);
			let streamUrl: string | null = null;
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
		} catch (err: any) {
			return reply.status(502).send({ error: "Failed to fetch stream info" });
		}
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
			} catch (err: any) {
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
		} catch (err: any) {
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
			} catch (err: any) {
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
			} catch (err: any) {
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
			} catch (err: any) {
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
				playlist: raw.playlist,
				tracks: raw.tracks.map(normalizeTrack).filter(Boolean),
			};
			playlistCache.set(cacheK, result);
			return result;
		} catch (err: any) {
			return reply.status(502).send({ error: "Failed to fetch playlist" });
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
					mix: raw.mix,
					tracks: raw.tracks.map(normalizeTrack).filter(Boolean),
				};
				mixCache.set(mixId, result);
				return result;
			} catch (err: any) {
				return reply.status(502).send({ error: "Failed to fetch mix" });
			}
		},
	);

	// ── Health Check ──────────────────────────────────────────────────────────

	app.get("/tidal/health", async (_req, reply) => {
		try {
			const { data } = await axios.get(`${config.tidalApiBaseUrl}/`);
			return { status: "ok", tidalApi: data };
		} catch (err: any) {
			return reply.status(503).send({
				status: "error",
				message: "Cannot reach Tidal-API",
			});
		}
	});
}
