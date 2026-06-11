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
	artist?: HifiArtist;
	artists?: HifiArtist[];
	album?: HifiAlbum;
	url?: string;
	streamStartDate?: string;
	trackNumber?: number;
	volumeNumber?: number;
	version?: string | null;
	copyright?: string;
	imageId?: string;
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

const DEFAULT_INSTANCES = {
	api: [
		{ url: "https://eu-central.monochrome.tf", version: "2.4" },
		{ url: "https://us-west.monochrome.tf", version: "2.4" },
		{ url: "https://arran.monochrome.tf", version: "2.4" },
		{ url: "https://triton.squid.wtf", version: "2.4" },
		{ url: "https://api.monochrome.tf", version: "2.3" },
		{ url: "https://monochrome-api.samidy.com", version: "2.3" },
		{ url: "https://maus.qqdl.site", version: "2.2" },
		{ url: "https://vogel.qqdl.site", version: "2.2" },
		{ url: "https://katze.qqdl.site", version: "2.2" },
		{ url: "https://hund.qqdl.site", version: "2.2" },
		{ url: "https://tidal.kinoplus.online", version: "2.2" },
		{ url: "https://wolf.qqdl.site", version: "2.2" },
	],
	streaming: [
		{ url: "https://arran.monochrome.tf", version: "2.4" },
		{ url: "https://triton.squid.wtf", version: "2.4" },
		{ url: "https://maus.qqdl.site", version: "2.2" },
		{ url: "https://vogel.qqdl.site", version: "2.2" },
		{ url: "https://katze.qqdl.site", version: "2.2" },
		{ url: "https://hund.qqdl.site", version: "2.2" },
		{ url: "https://wolf.qqdl.site", version: "2.2" },
		{ url: "https://hifi.p1nkhamster.xyz/", version: "2.6" },
	],
};

const DISCOVERY_URLS = [
	"https://tidal-uptime.jiffy-puffs-1j.workers.dev/",
	"https://tidal-uptime.props-76styles.workers.dev/",
];

class HifiClient {
	private http: AxiosInstance;
	private instances: any = DEFAULT_INSTANCES;
	private lastDiscovery = 0;
	private circuitOpenUntil = new Map<string, number>();

	constructor() {
		const baseURL = config.tidalApiBaseUrl || "http://localhost:9000";
		this.http = axios.create({
			baseURL,
			timeout: 30_000,
		});

		// Retry interceptor: handles failover to community instances
		this.http.interceptors.response.use(undefined, async (err: AxiosError) => {
			const cfg = err.config as any;
			cfg._retries = (cfg._retries ?? 0) + 1;

			if (cfg._retries > 5) throw err;
			await delay(
				Math.min(1500, 200 * 2 ** (cfg._retries - 1)) +
					Math.floor(Math.random() * 100),
			);

			// Proactively refresh instances if old
			if (Date.now() - this.lastDiscovery > 15 * 60 * 1000) {
				await this.discoverInstances().catch(() => {});
			}

			// Pick a new instance for retry if the current one failed (5xx or timeout)
			if (!err.response || err.response.status >= 500) {
				const type = cfg.url?.includes("/track") ? "streaming" : "api";
				const currentBaseUrl = String(
					cfg.baseURL ?? this.http.defaults.baseURL ?? "",
				);
				if (currentBaseUrl) {
					this.circuitOpenUntil.set(currentBaseUrl, Date.now() + 60_000);
				}
				const nextInstance = this.pickHealthyInstance(type);

				if (nextInstance) {
					cfg.baseURL = nextInstance.url;
					return this.http.request(cfg);
				}
			}

			throw err;
		});
	}

	private pickHealthyInstance(type: "api" | "streaming") {
		const pool = (this.instances[type] || this.instances.api) as Array<{
			url: string;
		}>;
		if (!pool.length) return null;
		const now = Date.now();
		const healthy = pool.filter((instance) => {
			const openUntil = this.circuitOpenUntil.get(instance.url) ?? 0;
			return openUntil <= now;
		});
		const candidates = healthy.length ? healthy : pool;
		return candidates[Math.floor(Math.random() * candidates.length)];
	}

	private async discoverInstances() {
		for (const url of DISCOVERY_URLS.sort(() => Math.random() - 0.5)) {
			try {
				const { data } = await axios.get(url, { timeout: 5000 });
				if (data && (data.api || data.streaming)) {
					this.instances = data;
					this.lastDiscovery = Date.now();
					return;
				}
			} catch {}
		}
	}

	/**
	 * Extract direct stream URL from DASH manifest
	 */
	public extractStreamUrlFromManifest(manifest: string | any): string | null {
		try {
			// If it's a base64 string, decode it
			let decoded = manifest;
			if (typeof manifest === "string" && !manifest.includes("<MPD")) {
				decoded = Buffer.from(manifest, "base64").toString("utf-8");
			}

			// Simple regex based search for priority formats in URLs
			// (Since we can't easily parse XML MPD here without heavy deps)
			const urls: string[] = [];
			const urlMatches = decoded.matchAll(/<BaseURL[^>]*>(.*?)<\/BaseURL>/g);
			for (const match of urlMatches) {
				if (match[1]) urls.push(match[1]);
			}

			// If no BaseURL, look for any https? URLs (Tidal dash manifests often use these)
			if (urls.length === 0) {
				const httpsMatches = decoded.matchAll(
					/https?:\/\/[^\s"<>]+?\.mp4\?[^\s"<>]+/g,
				);
				for (const match of httpsMatches) {
					urls.push(match[0]);
				}
			}

			if (urls.length === 0) return null;

			const priority = ["flac", "lossless", "hi-res", "high"];
			const sorted = urls.sort((a, b) => {
				const idxA = priority.findIndex((k) => a.toLowerCase().includes(k));
				const idxB = priority.findIndex((k) => b.toLowerCase().includes(k));
				return (
					(idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB) ||
					b.length - a.length
				);
			});

			return sorted[0] || null;
		} catch {
			return null;
		}
	}

	/**
	 * Generate a proxied image URL for a Tidal picture ID.
	 */
	public tidalImageUrl(
		pictureId: string | undefined | null,
		size: string | number = 640,
		type: "square" | "video" = "square",
	): string | null {
		if (!pictureId) return null;

		// Extract slug from absolute Tidal URLs if passed by mistake
		let slug = pictureId;
		if (
			typeof pictureId === "string" &&
			pictureId.includes("tidal.com/images/")
		) {
			const parts = pictureId.split("tidal.com/images/")[1];
			slug = parts.split("/")[0];
		}

		if (
			typeof slug === "string" &&
			(slug.startsWith("blob:") || slug.startsWith("assets/"))
		) {
			return slug;
		}

		const id = String(slug).replace(/\//g, "-");
		return `${config.apiBaseUrl}/tidal/images/${id}?size=${size}&type=${type}`;
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
		const payload = data.data ?? data;
		return { artist: payload.artist ?? payload, cover: payload.cover ?? null };
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
		const payload = data.data ?? data;
		return {
			albums: payload.albums ?? { items: [] },
			tracks: payload.tracks ?? [],
		};
	}

	async getSimilarArtists(id: number | string): Promise<HifiArtist[]> {
		const { data } = await this.http.get(`/artist/similar/`, {
			params: { id },
		});
		const payload = data.data ?? data;
		return payload.artists ?? payload;
	}

	async getSimilarAlbums(id: number | string): Promise<HifiAlbum[]> {
		const { data } = await this.http.get(`/album/similar/`, {
			params: { id },
		});
		const payload = data.data ?? data;
		return payload.albums ?? payload;
	}

	// ── Playlist ─────────────────────────────────────────────────────────────

	async getPlaylist(
		id: string,
		limit = 100,
		offset = 0,
	): Promise<{ playlist: HifiPlaylist; tracks: HifiTrack[] }> {
		const response = await this.http.get(`/playlist/`, {
			params: { id, limit, offset },
		});
		const data = response.data.data ?? response.data;

		let playlist: any = null;
		let tracksSection: any = null;

		// Check for direct property
		if (data.playlist) playlist = data.playlist;
		if (data.items) tracksSection = { items: data.items };

		// Fallback: iterate
		if (!playlist || !tracksSection) {
			const entries = Array.isArray(data) ? data : [data];
			for (const entry of entries) {
				if (!entry || typeof entry !== "object") continue;
				if (
					!playlist &&
					(entry.uuid || entry.numberOfTracks || (entry.title && entry.id))
				) {
					playlist = entry;
				}
				if (!tracksSection && entry.items) {
					tracksSection = entry;
				}
			}
		}

		if (!playlist) throw new Error("Playlist not found");

		let tracks = (tracksSection?.items || []).map((i: any) => i.item || i);

		// Pagination
		if (playlist.numberOfTracks > tracks.length) {
			let currentOffset = tracks.length;
			const SAFE_MAX = 5000;

			while (
				tracks.length < playlist.numberOfTracks &&
				tracks.length < SAFE_MAX
			) {
				try {
					const nextRes = await this.http.get(`/playlist/`, {
						params: { id, offset: currentOffset, limit: 100 },
					});
					const nextData = nextRes.data.data ?? nextRes.data;
					let nextItems: any[] = [];

					if (nextData.items) {
						nextItems = nextData.items;
					} else if (Array.isArray(nextData)) {
						for (const entry of nextData) {
							if (entry?.items) {
								nextItems = entry.items;
								break;
							}
						}
					}

					if (!nextItems || nextItems.length === 0) break;

					const prepared = nextItems.map((i) => i.item || i);
					// Loop safety
					if (tracks.length > 0 && prepared[0].id === tracks[0].id) break;

					tracks = tracks.concat(prepared);
					currentOffset += prepared.length;
				} catch {
					break;
				}
			}
		}

		return { playlist, tracks };
	}

	// ── Mix ──────────────────────────────────────────────────────────────────

	async getMix(id: string): Promise<{ mix: HifiMix; tracks: HifiTrack[] }> {
		const response = await this.http.get(`/mix/`, { params: { id } });
		const data = response.data.data ?? response.data;

		let mix: any = null;
		let tracks: any[] = [];

		if (data.mix) {
			mix = data.mix;
			tracks = data.items || [];
		} else {
			// Fallback: search for mix-like object and items
			const entries = Array.isArray(data) ? data : [data];
			for (const entry of entries) {
				if (entry.id && (entry.title || entry.subTitle)) {
					mix = entry;
				}
				if (entry.items) {
					tracks = entry.items;
				}
			}
			// If still no tracks but it's an array, it might be the tracks themselves
			if (tracks.length === 0 && Array.isArray(data)) {
				tracks = data;
			}
		}

		if (!mix) throw new Error("Mix not found");

		const preparedTracks = tracks.map((i: any) => i.item || i);

		return { mix, tracks: preparedTracks };
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
