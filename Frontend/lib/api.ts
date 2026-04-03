/**
 * lib/api.ts
 *
 * Frontend API client for the Muse backend.
 * All TIDAL data flows through the Muse backend's /tidal/* proxy routes,
 * which handle caching, authentication, and data normalization.
 *
 * SINGLE SOURCE OF TRUTH for API_BASE.
 */

export const API_BASE =
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
	id: string;
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

export interface HomeShelf {
	title: string;
	type: string;
	items: Array<{
		id: number | string;
		title: string;
		artist?: string;
		tidalId: number | string;
		imageUrl?: string | null;
		type: string;
		songs?: number;
	}>;
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

// ── SWR fetcher (single export for reuse) ────────────────────────────────────

export const swrFetcher = (url: string) => fetch(url).then((r) => r.json());

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

export async function getHomeShelves(): Promise<{ shelves: HomeShelf[] }> {
	return apiFetch(`/browse/home`);
}

export async function getPersonalizedHomeShelves(
	userId: string,
): Promise<{ shelves: HomeShelf[] }> {
	return apiFetch(`/users/${userId}/homepage`);
}

export async function saveSearch(data: {
	query?: string;
	itemType?: string;
	itemId?: string;
	imageUrl?: string;
	metadata?: any;
}): Promise<{ success: boolean }> {
	return apiFetch(`/browse/searches`, {
		method: "POST",
		body: JSON.stringify(data),
	});
}

// ── Track ────────────────────────────────────────────────────────────────────

export async function getTrackInfo(trackId: number): Promise<TidalTrack> {
	return apiFetch(`/tidal/tracks/${trackId}`);
}

export async function getStreamInfo(
	trackId: number,
	quality?: string,
): Promise<StreamInfo> {
	const url = quality
		? `/tidal/tracks/${trackId}/stream?quality=${encodeURIComponent(quality)}`
		: `/tidal/tracks/${trackId}/stream`;
	return apiFetch(url);
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

// ── Library ──────────────────────────────────────────────────────────────────

export async function getLibrary(): Promise<{
	library: { itemType: string; itemId: string; isPinned: boolean }[];
}> {
	return apiFetch(`/library`);
}

export async function addToLibrary(
	itemType: string,
	itemId: string,
): Promise<{ success: boolean }> {
	return apiFetch(`/library`, {
		method: "POST",
		body: JSON.stringify({ itemType, itemId }),
	});
}

export async function removeFromLibrary(
	itemType: string,
	itemId: string,
): Promise<{ success: boolean }> {
	return apiFetch(`/library`, {
		method: "DELETE",
		body: JSON.stringify({ itemType, itemId }),
	});
}

// ── Playlists ────────────────────────────────────────────────────────────────

export async function getPlaylists(): Promise<{
	playlists: { id: string; title: string; description?: string }[];
}> {
	return apiFetch(`/playlists`);
}

export async function createPlaylist(
	title: string,
	description?: string,
): Promise<{ id: string; success: boolean }> {
	return apiFetch(`/playlists`, {
		method: "POST",
		body: JSON.stringify({ title, description }),
	});
}

export async function deletePlaylist(
	id: string,
): Promise<{ success: boolean }> {
	return apiFetch(`/playlists/${id}`, { method: "DELETE" });
}

export async function addTrackToPlaylist(
	playlistId: string,
	trackId: string,
): Promise<{ success: boolean }> {
	return apiFetch(`/playlists/${playlistId}/tracks`, {
		method: "POST",
		body: JSON.stringify({ trackId }),
	});
}

export async function removeTrackFromPlaylist(
	playlistId: string,
	trackId: string,
): Promise<{ success: boolean }> {
	return apiFetch(`/playlists/${playlistId}/tracks/${trackId}`, {
		method: "DELETE",
	});
}

// ── Actions ──────────────────────────────────────────────────────────────────

export async function executeAction(
	action: string,
	type: string,
	id: string,
	userId: string,
	target?: string,
): Promise<any> {
	return apiFetch(`/actions/${action}`, {
		method: "POST",
		body: JSON.stringify({ userId, type, id, target }),
	});
}

// ── Context Menu ─────────────────────────────────────────────────────────────

export async function getContextMenuState(
	type: string,
	id: string,
	userId: string,
): Promise<{ inLibrary: boolean; isPinned: boolean }> {
	return apiFetch(`/context-menu/${type}/${id}?userId=${userId}`);
}

// ── Health ───────────────────────────────────────────────────────────────────

export async function checkTidalHealth(): Promise<{ status: string }> {
	return apiFetch(`/tidal/health`);
}
