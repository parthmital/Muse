/**
 * src/services/hifiClient.ts
 *
 * Client for the local Tidal-API proxy (hifi-api).
 * Tidal-API handles TIDAL authentication internally via token.json,
 * so no auth headers are needed from this client.
 *
 * Endpoints consumed:
 *   GET /info/?id=        → track metadata
 *   GET /search/?s=       → track search
 *   GET /search/?a=       → artist search
 *   GET /search/?al=      → album search
 *   GET /search/?p=       → playlist search
 *   GET /recommendations/ → track recommendations
 *   GET /album/?id=       → album + tracks
 *   GET /artist/?id=      → artist metadata
 *   GET /artist/?f=       → artist albums + tracks
 *   GET /artist/similar/  → similar artists
 *   GET /album/similar/   → similar albums
 *   GET /playlist/?id=    → playlist + tracks
 *   GET /mix/?id=         → mix tracks
 *   GET /track/?id=       → playback stream info
 */

import axios, { AxiosInstance, AxiosError } from "axios";
import { config } from "../config.js";

// ── Response types ──────────────────────────────────────────────────────────────

export interface HifiTrack {
	id: number | string;
	title: string;
	duration?: number;
	bpm?: number;
	key?: string;
	keyScale?: string;
	popularity?: number;
	explicit?: boolean;
	audioQuality?: string;
	isrc?: string;
	mixes?: Record<string, string>;
	replayGain?: number;
	artist?: HifiArtist;
	artists?: HifiArtist[];
	album?: HifiAlbum;
	url?: string;
	streamStartDate?: string;
	trackNumber?: number;
	volumeNumber?: number;
	version?: string | null;
	copyright?: string;
}

export interface HifiArtist {
	id: number | string;
	name: string;
	popularity?: number;
	picture?: string;
	artistTypes?: string[];
	url?: string;
	mixes?: Record<string, string>;
}

export interface HifiAlbum {
	id: number | string;
	title: string;
	cover?: string;
	vibrantColor?: string;
	releaseDate?: string;
	numberOfTracks?: number;
	duration?: number;
	type?: string;
	artist?: HifiArtist;
	artists?: HifiArtist[];
	url?: string;
}

export interface HifiPlaylist {
	uuid?: string;
	title: string;
	numberOfTracks?: number;
	description?: string;
	duration?: number;
	creator?: { id: number };
	squareImage?: string;
	image?: string;
	url?: string;
}

export interface HifiMix {
	id: string;
	title: string;
	subTitle?: string;
	images?: Record<string, { width: number; height: number; url: string }>;
}

export interface HifiStreamInfo {
	trackId: number;
	audioQuality: string;
	manifestMimeType: string;
	manifest: string;
	bitDepth?: number;
	sampleRate?: number;
}

export interface TidalSearchResult {
	items: HifiTrack[];
	limit: number;
	offset: number;
	totalNumberOfItems: number;
}

export interface TidalArtistSearchResult {
	artists: {
		items: HifiArtist[];
		limit: number;
		offset: number;
		totalNumberOfItems: number;
	};
}

// ── Client ──────────────────────────────────────────────────────────────────────

class HifiClient {
	private http: AxiosInstance;

	constructor() {
		const baseURL = config.tidalApiBaseUrl || "http://localhost:9000";
		this.http = axios.create({
			baseURL,
			timeout: 30_000,
		});

		// Retry interceptor: retry up to 3 times on 5xx with exponential backoff
		this.http.interceptors.response.use(undefined, async (err: AxiosError) => {
			const cfg = err.config as any;
			cfg._retries = (cfg._retries ?? 0) + 1;
			if (
				cfg._retries <= 3 &&
				err.response?.status &&
				err.response.status >= 500
			) {
				await delay(cfg._retries * 1000);
				return this.http.request(cfg);
			}
			throw err;
		});
	}

	// ── Track Info ────────────────────────────────────────────────────────────

	/** Fetch track metadata by Tidal track ID */
	async getTrackInfo(id: number | string): Promise<HifiTrack> {
		const { data } = await this.http.get(`/info/`, { params: { id } });
		return data.data ?? data;
	}

	/** Fetch multiple tracks by searching for each (Tidal-API has no batch endpoint) */
	async getTracks(ids: (number | string)[]): Promise<HifiTrack[]> {
		const results: HifiTrack[] = [];
		for (const chunk of chunks(ids, 10)) {
			const batch = await Promise.allSettled(
				chunk.map((trackId) => this.getTrackInfo(trackId)),
			);
			for (const r of batch) {
				if (r.status === "fulfilled") results.push(r.value);
			}
		}
		return results;
	}

	// ── Search ───────────────────────────────────────────────────────────────

	async searchTracks(
		query: string,
		limit = 25,
		offset = 0,
	): Promise<TidalSearchResult> {
		const { data } = await this.http.get(`/search/`, {
			params: { s: query, limit, offset },
		});
		const payload = data.data ?? data;
		return {
			items: payload.items ?? [],
			limit: payload.limit ?? limit,
			offset: payload.offset ?? offset,
			totalNumberOfItems: payload.totalNumberOfItems ?? 0,
		};
	}

	async searchArtists(
		query: string,
		limit = 25,
		offset = 0,
	): Promise<TidalArtistSearchResult> {
		const { data } = await this.http.get(`/search/`, {
			params: { a: query, limit, offset },
		});
		const payload = data.data ?? data;
		return { artists: payload.artists ?? payload };
	}

	async searchAlbums(
		query: string,
		limit = 25,
		offset = 0,
	): Promise<TidalSearchResult> {
		const { data } = await this.http.get(`/search/`, {
			params: { al: query, limit, offset },
		});
		const payload = data.data ?? data;
		// Album search returns under "albums" key
		const albums = payload.albums ?? payload;
		return {
			items: albums.items ?? [],
			limit: albums.limit ?? limit,
			offset: albums.offset ?? offset,
			totalNumberOfItems: albums.totalNumberOfItems ?? 0,
		};
	}

	async searchPlaylists(
		query: string,
		limit = 25,
		offset = 0,
	): Promise<TidalSearchResult> {
		const { data } = await this.http.get(`/search/`, {
			params: { p: query, limit, offset },
		});
		const payload = data.data ?? data;
		const playlists = payload.playlists ?? payload;
		return {
			items: playlists.items ?? [],
			limit: playlists.limit ?? limit,
			offset: playlists.offset ?? offset,
			totalNumberOfItems: playlists.totalNumberOfItems ?? 0,
		};
	}

	// ── Recommendations ──────────────────────────────────────────────────────

	/** TIDAL-native recommendations for a given track */
	async getRecommendations(trackId: number | string): Promise<HifiTrack[]> {
		const { data } = await this.http.get(`/recommendations/`, {
			params: { id: trackId },
		});
		const payload = data.data ?? data;
		// Items may be wrapped: { track: {...} } or flat
		const rawItems = payload.items ?? [];
		return rawItems.map((item: any) => item.track ?? item);
	}

	// ── Album ────────────────────────────────────────────────────────────────

	async getAlbum(
		id: number | string,
		limit = 100,
		offset = 0,
	): Promise<{ album: HifiAlbum; tracks: HifiTrack[] }> {
		const { data } = await this.http.get(`/album/`, {
			params: { id, limit, offset },
		});
		const payload = data.data ?? data;

		const album: HifiAlbum = { ...payload };
		delete (album as any).items;

		const tracks: HifiTrack[] = (payload.items ?? []).map(
			(item: any) => item.item ?? item,
		);

		return { album, tracks };
	}

	// ── Artist ───────────────────────────────────────────────────────────────

	async getArtist(id: number | string): Promise<{
		artist: HifiArtist;
		cover: { "750"?: string } | null;
	}> {
		const { data } = await this.http.get(`/artist/`, { params: { id } });
		return { artist: data.artist ?? data.data, cover: data.cover ?? null };
	}

	async getArtistAlbums(
		artistId: number | string,
		skipTracks = true,
	): Promise<{
		albums: any;
		tracks: HifiTrack[];
	}> {
		const { data } = await this.http.get(`/artist/`, {
			params: { f: artistId, skip_tracks: skipTracks },
		});
		return {
			albums: data.albums ?? { items: [] },
			tracks: data.tracks ?? [],
		};
	}

	async getSimilarArtists(id: number | string): Promise<HifiArtist[]> {
		const { data } = await this.http.get(`/artist/similar/`, {
			params: { id },
		});
		return data.artists ?? [];
	}

	async getSimilarAlbums(id: number | string): Promise<HifiAlbum[]> {
		const { data } = await this.http.get(`/album/similar/`, {
			params: { id },
		});
		return data.albums ?? [];
	}

	// ── Playlist ─────────────────────────────────────────────────────────────

	async getPlaylist(
		id: string,
		limit = 100,
		offset = 0,
	): Promise<{ playlist: HifiPlaylist; tracks: HifiTrack[] }> {
		const { data } = await this.http.get(`/playlist/`, {
			params: { id, limit, offset },
		});
		return {
			playlist: data.playlist ?? {},
			tracks: (data.items ?? []).map((item: any) => item.item ?? item),
		};
	}

	// ── Mix ──────────────────────────────────────────────────────────────────

	async getMix(id: string): Promise<{ mix: HifiMix; tracks: HifiTrack[] }> {
		const { data } = await this.http.get(`/mix/`, { params: { id } });
		return {
			mix: data.mix ?? {},
			tracks: data.items ?? [],
		};
	}

	// ── Stream / Playback Info ───────────────────────────────────────────────

	async getStreamInfo(
		trackId: number | string,
		quality = "HI_RES_LOSSLESS",
	): Promise<HifiStreamInfo> {
		const { data } = await this.http.get(`/track/`, {
			params: { id: trackId, quality },
		});
		return data.data ?? data;
	}

	// ── Catalogue streaming (for ingestion/seeding) ──────────────────────────

	async *streamCatalogue(pageSize = 100): AsyncGenerator<HifiTrack> {
		// Use search with popular queries to seed the catalogue
		const seedQueries = [
			"pop",
			"rock",
			"hip hop",
			"electronic",
			"r&b",
			"jazz",
			"classical",
			"indie",
			"metal",
			"country",
		];
		for (const query of seedQueries) {
			let offset = 0;
			while (true) {
				const result = await this.searchTracks(query, pageSize, offset);
				for (const item of result.items) yield item;
				if (result.items.length < pageSize) break;
				offset += pageSize;
				if (offset >= 200) break; // cap per-query
			}
		}
	}
}

function chunks<T>(arr: T[], n: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
	return out;
}

function delay(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

export const hifiClient = new HifiClient();
