/**
 * lib/api.ts
 *
 * Frontend API client for the Muse backend.
 * All TIDAL data flows through the Muse backend's /tidal/* proxy routes,
 * which handle caching, authentication, and data normalization.
 *
 * SINGLE SOURCE OF TRUTH for API_BASE.
 */
import { logger } from "@/lib/logger";

export const API_BASE =
	process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

const inflightGetRequests = new Map<string, Promise<unknown>>();

// ── Auth token ───────────────────────────────────────────────────────────────
// The session token is persisted in localStorage and attached as a Bearer
// header on every request. AuthContext is the writer; this module is the reader.

const TOKEN_KEY = "muse-token";

export function getAuthToken(): string | null {
	if (typeof window === "undefined") return null;
	return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
	if (typeof window === "undefined") return;
	if (token) window.localStorage.setItem(TOKEN_KEY, token);
	else window.localStorage.removeItem(TOKEN_KEY);
}

/** Clear the token and bounce to /login (called on an unexpected 401). */
function handleUnauthorized(): void {
	setAuthToken(null);
	if (typeof window !== "undefined") {
		const path = window.location.pathname;
		if (path !== "/login" && path !== "/signup") {
			window.location.href = "/login";
		}
	}
}

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
	tidalId?: number | string;
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
	creator?: {
		id?: number;
		name?: string;
		picture?: string | null;
	} | null;
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
	subtitle?: string;
	type: string;
	items: Array<{
		id: number | string;
		title: string;
		artist?: string;
		tidalId: number | string;
		imageUrl?: string | null;
		type: string;
		songs?: number;
		artistImages?: string[];
	}>;
}

// ── Fetch helper ─────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const url = `${API_BASE}${path}`;
	const method = (init?.method ?? "GET").toUpperCase();
	const isGet = method === "GET" && !init?.body;
	const requestKey = isGet ? url : null;

	if (requestKey) {
		const inflight = inflightGetRequests.get(requestKey);
		if (inflight) {
			return inflight as Promise<T>;
		}
	}

	const requestPromise = (async () => {
		const token = getAuthToken();
		let res: Response;
		try {
			res = await fetch(url, {
				...init,
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {}),
					...init?.headers,
				},
			});
		} catch (error) {
			// Aborted requests (e.g. debounced search / live-search cleanup calling
			// controller.abort()) are expected — propagate without logging an error.
			if ((error as { name?: string } | null)?.name === "AbortError") {
				throw error;
			}
			logger.error("apiFetch", "Network failure while calling backend", error, {
				url,
				method,
			});
			throw error;
		}

		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			logger.warn("apiFetch", "Backend returned non-OK response", {
				url,
				method,
				status: res.status,
				statusText: res.statusText,
				body,
			});
			// An expired/invalid session on a non-auth route: drop the token and
			// send the user to login. Auth routes (login/signup) surface their own
			// 401s so the form can show "invalid credentials".
			if (res.status === 401 && !path.startsWith("/auth")) {
				handleUnauthorized();
			}
			throw new ApiError(res.status, body.error ?? res.statusText, body);
		}

		try {
			return (await res.json()) as T;
		} catch (error) {
			logger.error("apiFetch", "Failed to parse backend JSON response", error, {
				url,
				method,
			});
			throw error;
		}
	})();

	if (!requestKey) {
		return requestPromise;
	}

	inflightGetRequests.set(requestKey, requestPromise);
	try {
		return (await requestPromise) as T;
	} finally {
		inflightGetRequests.delete(requestKey);
	}
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

export const swrFetcher = (pathOrUrl: string) => {
	// Full URLs that point at our backend still need the auth header; route them
	// through apiFetch by stripping API_BASE. External URLs fetch as-is.
	if (pathOrUrl.startsWith(API_BASE)) {
		return apiFetch(pathOrUrl.slice(API_BASE.length));
	}
	if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
		return fetch(pathOrUrl).then((r) => r.json());
	}
	return apiFetch(pathOrUrl);
};

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

export interface GenreTag {
	label: string;
	tag: string;
}

// Live genre list for the Discover filter bar, sourced from Last.fm top tags.
export async function fetchGenres(
	limit = 12,
	signal?: AbortSignal,
): Promise<{ genres: GenreTag[] }> {
	return apiFetch(`/tidal/genres?limit=${limit}`, { signal });
}

// Top albums for a genre tag (null = global chart popularity), already resolved
// to real TIDAL albums by the backend's relevance-gated matcher.
export async function genreAlbums(
	tag: string | null,
	limit = 50,
	signal?: AbortSignal,
): Promise<SearchResult<TidalAlbum>> {
	const q = tag
		? `tag=${encodeURIComponent(tag)}&limit=${limit}`
		: `limit=${limit}`;
	return apiFetch(`/tidal/genre-albums?${q}`, { signal });
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
	const response = await apiFetch<{ shelves: HomeShelf[] }>(`/browse/home`);
	logger.info("getHomeShelves", "Fetched browse home shelves", {
		shelfCount: response.shelves?.length ?? 0,
		totalItems:
			response.shelves?.reduce(
				(total, shelf) => total + (shelf.items?.length ?? 0),
				0,
			) ?? 0,
	});
	return response;
}

export async function getPersonalizedHomeShelves(
	userId: string,
): Promise<{ shelves: HomeShelf[] }> {
	try {
		const response = await apiFetch<{ shelves: HomeShelf[] }>(
			`/users/${userId}/homepage`,
		);
		if (response.shelves?.length) {
			return response;
		}
		logger.info(
			"getPersonalizedHomeShelves",
			"Personalized shelves were empty",
			{
				userId,
			},
		);
	} catch (error) {
		logger.warn(
			"getPersonalizedHomeShelves",
			"Personalized homepage request failed, falling back to browse home",
			{
				userId,
				error:
					error instanceof Error
						? { name: error.name, message: error.message }
						: error,
			},
		);
	}

	const fallback = await getHomeShelves();
	if (!fallback.shelves?.some((shelf) => shelf.items?.length)) {
		logger.warn(
			"getPersonalizedHomeShelves",
			"Fallback browse home shelves are also empty",
			{ userId },
		);
	}
	return fallback;
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
): Promise<{ playlist: TidalPlaylist; tracks: TidalTrack[] }> {
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

export async function getPlaylistTracks(
	playlistId: string,
): Promise<{ tracks: { trackId: string }[] }> {
	return apiFetch(`/playlists/${playlistId}/tracks`);
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

// ── Last.fm ─────────────────────────────────────────────────────────────────

export interface LastFmArtistInfo {
	name: string;
	mbid?: string;
	listeners: string;
	playcount: string;
	bio: {
		summary: string;
		content: string;
	};
	similar: Array<{
		name: string;
		url: string;
		image?: string;
	}>;
	tags: string[];
}

export interface LastFmTagInfo {
	name: string;
	url: string;
	reach: string;
	taggings: string;
	streamable: string;
	wiki: {
		published: string;
		summary: string;
		content: string;
	};
}

export interface LastFmSimilarTag {
	name: string;
	url: string;
	streamable: string;
}

export async function getLastFmArtistInfo(
	artistName: string,
): Promise<LastFmArtistInfo | null> {
	return apiFetch(`/lastfm/artist/${encodeURIComponent(artistName)}`);
}

export async function getLastFmTagInfo(
	tagName: string,
): Promise<LastFmTagInfo | null> {
	return apiFetch(`/lastfm/tag/${encodeURIComponent(tagName)}`);
}

export async function getLastFmSimilarTags(
	tagName: string,
	limit?: number,
): Promise<{ similar: LastFmSimilarTag[] } | null> {
	const query = limit ? `?limit=${limit}` : "";
	return apiFetch(`/lastfm/tag/${encodeURIComponent(tagName)}/similar${query}`);
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
	id: string;
	email: string | null;
	displayName: string | null;
}

export interface AuthResult {
	token: string;
	tokenType: string;
	expiresIn: number;
	user: AuthUser;
}

export async function signup(
	email: string,
	password: string,
	displayName: string,
): Promise<AuthResult> {
	return apiFetch(`/auth/signup`, {
		method: "POST",
		body: JSON.stringify({ email, password, displayName }),
	});
}

export async function login(
	email: string,
	password: string,
): Promise<AuthResult> {
	return apiFetch(`/auth/login`, {
		method: "POST",
		body: JSON.stringify({ email, password }),
	});
}

export async function getMe(): Promise<{ user: AuthUser }> {
	return apiFetch(`/auth/me`);
}

// ── Settings ─────────────────────────────────────────────────────────────────

export interface UserSettings {
	streamingQuality: string;
	downloadQuality: string;
	dataSaver: boolean;
	gaplessPlayback: boolean;
	automix: boolean;
	allowExplicit: boolean;
}

export async function getSettings(): Promise<{ settings: UserSettings }> {
	return apiFetch(`/settings`);
}

export async function updateSettings(
	patch: Partial<UserSettings>,
): Promise<{ settings: UserSettings }> {
	return apiFetch(`/settings`, {
		method: "PUT",
		body: JSON.stringify(patch),
	});
}

// ── Listening insights (profile) ─────────────────────────────────────────────

export interface TopTrack {
	id: string;
	title: string;
	artist: string | null;
	artistId: string | null;
	album: string | null;
	coverUrl: string | null;
	playCount: number;
}

export interface TopArtist {
	id: string;
	name: string;
	pictureUrl: string | null;
	playCount: number;
}

export async function getTopTracks(
	userId: string,
	limit = 10,
): Promise<{ tracks: TopTrack[] }> {
	return apiFetch(`/users/${userId}/top-tracks?limit=${limit}`);
}

export async function getTopArtists(
	userId: string,
	limit = 10,
): Promise<{ artists: TopArtist[] }> {
	return apiFetch(`/users/${userId}/top-artists?limit=${limit}`);
}

// ── Interactions (listening-event reporting) ─────────────────────────────────

export type InteractionEventType =
	| "play"
	| "skip"
	| "like"
	| "unlike"
	| "save"
	| "unsave"
	| "playlist_add"
	| "repeat";

export interface InteractionEvent {
	eventType: InteractionEventType;
	trackId?: string;
	artistId?: string;
	albumId?: string;
	playDurationSec?: number;
	trackDurationSec?: number;
	occurredAt?: number;
}

export async function reportInteraction(
	userId: string,
	event: InteractionEvent,
): Promise<void> {
	await apiFetch(`/users/${userId}/interactions`, {
		method: "POST",
		body: JSON.stringify(event),
	});
}
