/**
 * lib/api.ts
 *
 * Frontend API client for the Muse backend.
 * All TIDAL data flows through the Muse backend's /tidal/* proxy routes,
 * which handle caching, authentication, and data normalization.
 */

const API_BASE =
	process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TidalTrack {
	id: number;
	title: string;
	duration: number;
	trackNumber?: number;
	volumeNumber?: number;
	popularity?: number;
	explicit?: boolean;
	audioQuality?: string;
	isrc?: string;
	bpm?: number;
	key?: string;
	version?: string | null;
	url?: string;
	artist: {
		id: number;
		name: string;
		picture?: string | null;
	} | null;
	artists: Array<{
		id: number;
		name: string;
		picture?: string | null;
	}>;
	album: {
		id: number;
		title: string;
		cover?: string | null;
		vibrantColor?: string | null;
		releaseDate?: string | null;
	} | null;
	mixes?: Record<string, string>;
	imageId?: string;
	videoCover?: string | null;
}

export interface TidalArtist {
	id: number;
	name: string;
	popularity?: number;
	picture?: string | null;
	url?: string;
	artistTypes?: string[];
	mixes?: Record<string, string>;
}

export interface TidalAlbum {
	id: number;
	title: string;
	cover?: string | null;
	vibrantColor?: string | null;
	releaseDate?: string | null;
	numberOfTracks?: number;
	duration?: number;
	type?: string;
	explicit?: boolean;
	audioQuality?: string;
	url?: string;
	artist: {
		id: number;
		name: string;
		picture?: string | null;
	} | null;
	artists: Array<{
		id: number;
		name: string;
		picture?: string | null;
	}>;
}

export interface TidalPlaylist {
	id: string; // UUID
	title: string;
	description?: string;
	numberOfTracks?: number;
	duration?: number;
	image?: string | null;
	url?: string;
}

export interface TidalMix {
	id: string;
	title: string;
	subTitle?: string;
	description?: string;
	cover?: string | null;
}

export interface SearchResult<T> {
	type: string;
	items: T[];
	limit: number;
	offset: number;
	totalNumberOfItems: number;
}

export interface StreamInfo {
	trackId: number;
	audioQuality: string;
	manifestMimeType: string;
	manifest: string;
	streamUrl: string | null;
	bitDepth?: number;
	sampleRate?: number;
}

// ── Fetch helper ─────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const url = `${API_BASE}${path}`;
	const res = await fetch(url, {
		...init,
		headers: {
			"Content-Type": "application/json",
			...init?.headers,
		},
	});

	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new ApiError(res.status, body.error ?? res.statusText, body);
	}

	return res.json();
}

export class ApiError extends Error {
	constructor(
		public status: number,
		message: string,
		public body?: any,
	) {
		super(message);
		this.name = "ApiError";
	}
}

// ── Search ───────────────────────────────────────────────────────────────────

export async function searchTracks(
	query: string,
	limit = 25,
	offset = 0,
	signal?: AbortSignal,
): Promise<SearchResult<TidalTrack>> {
	return apiFetch(
		`/tidal/search?q=${encodeURIComponent(query)}&type=tracks&limit=${limit}&offset=${offset}`,
		{ signal },
	);
}

export async function searchArtists(
	query: string,
	limit = 25,
	offset = 0,
	signal?: AbortSignal,
): Promise<SearchResult<TidalArtist>> {
	return apiFetch(
		`/tidal/search?q=${encodeURIComponent(query)}&type=artists&limit=${limit}&offset=${offset}`,
		{ signal },
	);
}

export async function searchAlbums(
	query: string,
	limit = 25,
	offset = 0,
	signal?: AbortSignal,
): Promise<SearchResult<TidalAlbum>> {
	return apiFetch(
		`/tidal/search?q=${encodeURIComponent(query)}&type=albums&limit=${limit}&offset=${offset}`,
		{ signal },
	);
}

export async function searchPlaylists(
	query: string,
	limit = 25,
	offset = 0,
	signal?: AbortSignal,
): Promise<SearchResult<TidalPlaylist>> {
	return apiFetch(
		`/tidal/search?q=${encodeURIComponent(query)}&type=playlists&limit=${limit}&offset=${offset}`,
		{ signal },
	);
}

export async function searchAll(
	query: string,
	limit = 10,
	signal?: AbortSignal,
): Promise<{
	tracks: TidalTrack[];
	artists: TidalArtist[];
	albums: TidalAlbum[];
	playlists: TidalPlaylist[];
	mixes?: TidalMix[];
	query: string;
}> {
	return apiFetch(
		`/tidal/search/all?q=${encodeURIComponent(query)}&limit=${limit}`,
		{ signal },
	);
}

// ── Browse ───────────────────────────────────────────────────────────────────

export async function getSearchSections(): Promise<{
	categories: Array<{ title: string; items: string[] }>;
}> {
	return apiFetch(`/browse/search-sections`);
}

export async function getRecentSearches(): Promise<{ items: any[] }> {
	return apiFetch(`/browse/recent-searches`);
}

// ── Track ────────────────────────────────────────────────────────────────────

export async function getTrackInfo(trackId: number): Promise<TidalTrack> {
	return apiFetch(`/tidal/tracks/${trackId}`);
}

export async function getStreamInfo(
	trackId: number,
	quality = "LOSSLESS",
): Promise<StreamInfo> {
	return apiFetch(
		`/tidal/tracks/${trackId}/stream?quality=${encodeURIComponent(quality)}`,
	);
}

// ── Recommendations ──────────────────────────────────────────────────────────

export async function getRecommendations(
	trackId: number,
): Promise<{ trackId: string; items: TidalTrack[] }> {
	return apiFetch(`/tidal/tracks/${trackId}/recommendations`);
}

// ── Album ────────────────────────────────────────────────────────────────────

export async function getAlbum(
	albumId: number,
	limit = 100,
	offset = 0,
): Promise<{ album: TidalAlbum; tracks: TidalTrack[] }> {
	return apiFetch(`/tidal/albums/${albumId}?limit=${limit}&offset=${offset}`);
}

export async function getSimilarAlbums(
	albumId: number,
): Promise<{ albums: TidalAlbum[] }> {
	return apiFetch(`/tidal/albums/${albumId}/similar`);
}

// ── Artist ───────────────────────────────────────────────────────────────────

export async function getArtist(artistId: number): Promise<{
	artist: TidalArtist;
	cover: { "750"?: string } | null;
	albums: TidalAlbum[];
	topTracks: TidalTrack[];
}> {
	return apiFetch(`/tidal/artists/${artistId}`);
}

export async function getSimilarArtists(
	artistId: number,
): Promise<{ artists: TidalArtist[] }> {
	return apiFetch(`/tidal/artists/${artistId}/similar`);
}

// ── Playlist ─────────────────────────────────────────────────────────────────

export async function getPlaylist(
	playlistId: string,
	limit = 100,
	offset = 0,
): Promise<{ playlist: any; tracks: TidalTrack[] }> {
	return apiFetch(
		`/tidal/playlists/${playlistId}?limit=${limit}&offset=${offset}`,
	);
}

// ── Mix ──────────────────────────────────────────────────────────────────────

export async function getMix(
	mixId: string,
): Promise<{ mix: any; tracks: TidalTrack[] }> {
	return apiFetch(`/tidal/mixes/${mixId}`);
}

// ── Health ───────────────────────────────────────────────────────────────────

export async function checkTidalHealth(): Promise<{ status: string }> {
	return apiFetch(`/tidal/health`);
}
