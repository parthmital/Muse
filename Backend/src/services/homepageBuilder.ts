import { randomUUID } from "node:crypto";
import {
	getDb,
	resolveUser,
	fromJson,
	toJson,
	type UserRow,
} from "../db/helpers.js";
import { hifiClient, type HifiTrack } from "./hifiClient.js";
import {
	recommend,
	getAlbumsForYou,
	getFavouriteArtists,
} from "./recommender.js";
import {
	fetchTrendingTracksFallback,
	fetchPopularArtistsFallback,
	fetchPopularAlbumsFallback,
} from "./popularityService.js";

const SECTION_ITEM_COUNT = 10;
const COLLECTION_TRACK_COUNT = 50;

function normalizeImageUrl(
	value: string | null | undefined,
	type: "square" | "video" = "square",
): string | null {
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
	return hifiClient.tidalImageUrl(value, 640, type);
}

type PoolTrack = {
	trackId: string;
	title: string;
	artistId: string | null;
	artistName: string | null;
	artistImageUrl: string | null;
	albumTitle: string | null;
	coverUrl: string | null;
	popularity: number;
};

export type HomepageShelfItem = {
	id: string | number;
	title: string;
	tidalId: string | number;
	imageUrl: string | null;
	type: string;
	artist?: string | null;
	songs?: number;
};

export type HomepageShelf = {
	title: string;
	type: string;
	items: HomepageShelfItem[];
};

function dedupeStrings(values: Array<string | null | undefined>): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const value of values) {
		const normalized = (value ?? "").trim();
		if (!normalized) continue;
		const key = normalized.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(normalized);
	}
	return out;
}

function toPoolTrack(row: any): PoolTrack {
	return {
		trackId: String(row.track_id ?? row.id),
		title: row.title ?? "Unknown Track",
		artistId: row.artist_id != null ? String(row.artist_id) : null,
		artistName: row.artist_name ?? null,
		artistImageUrl: normalizeImageUrl(row.artist_picture_url ?? null),
		albumTitle: row.album_title ?? null,
		coverUrl: normalizeImageUrl(row.cover_url ?? null),
		popularity: Number(row.popularity ?? 0),
	};
}

function pickDominantArtistCover(
	trackIds: string[],
	poolById: Map<string, PoolTrack>,
): string | null {
	const artistCounts = new Map<
		string,
		{ count: number; imageUrl: string | null }
	>();
	for (const trackId of trackIds) {
		const track = poolById.get(trackId);
		if (!track?.artistId) continue;
		const current = artistCounts.get(track.artistId);
		if (!current) {
			artistCounts.set(track.artistId, {
				count: 1,
				imageUrl: track.artistImageUrl ?? null,
			});
			continue;
		}
		current.count += 1;
		if (!current.imageUrl && track.artistImageUrl) {
			current.imageUrl = track.artistImageUrl;
		}
	}

	let best: { count: number; imageUrl: string | null } | null = null;
	for (const value of artistCounts.values()) {
		if (!best || value.count > best.count) {
			best = value;
		}
	}
	return best?.imageUrl ?? null;
}

function stableOffset(seed: string, modulo: number): number {
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
	}
	return modulo > 0 ? hash % modulo : 0;
}

function pickTrackIds(
	poolIds: string[],
	start: number,
	count: number,
): string[] {
	if (!poolIds.length) return [];
	const picked: string[] = [];
	const seen = new Set<string>();
	let i = 0;
	while (picked.length < count && i < poolIds.length * 3) {
		const id = poolIds[(start + i) % poolIds.length];
		if (!seen.has(id)) {
			seen.add(id);
			picked.push(id);
		}
		i++;
	}

	// If still short (very small pool), pad by cycling.
	let j = 0;
	while (picked.length < count) {
		picked.push(poolIds[j % poolIds.length]);
		j++;
	}
	return picked;
}

function ensureCount<T>(
	items: T[],
	minCount: number,
	createItem: (i: number) => T,
): T[] {
	const out = items.slice(0, minCount);
	for (let i = out.length; i < minCount; i++) {
		out.push(createItem(i));
	}
	return out;
}

function getUserInteractionCount(userId: string): number {
	const db = getDb();
	const row = db
		.prepare("SELECT COUNT(*) as c FROM user_interactions WHERE user_id = ?")
		.get(userId) as { c: number };
	return row?.c ?? 0;
}

function resolveOrCreateUser(externalId: string): UserRow {
	const db = getDb();
	let user = resolveUser(externalId);
	if (!user) {
		const id = randomUUID();
		db.prepare(
			"INSERT INTO users (id, external_id, is_new, created_at, updated_at) VALUES (?, ?, 1, unixepoch(), unixepoch())",
		).run(id, externalId);
		user = resolveUser(externalId);
	}
	if (!user) throw new Error(`Unable to resolve user ${externalId}`);
	return user;
}

function upsertTracks(tracks: HifiTrack[]) {
	if (!tracks.length) return;
	const db = getDb();

	const insertArtist = db.prepare(
		"INSERT OR IGNORE INTO artists (id, name, popularity, picture_url, raw_api_data, updated_at) VALUES (?, ?, ?, ?, ?, unixepoch())",
	);
	const insertAlbum = db.prepare(
		"INSERT OR IGNORE INTO albums (id, title, cover_url, vibrant_color, raw_api_data, updated_at) VALUES (?, ?, ?, ?, ?, unixepoch())",
	);
	const insertTrack = db.prepare(
		`INSERT OR IGNORE INTO tracks 
		(id, title, duration, bpm, key, key_scale, popularity, explicit, audio_quality, isrc, mix_ids, raw_api_data, artist_id, album_id, created_at, updated_at) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`,
	);
	const insertFeatures = db.prepare(
		"INSERT OR IGNORE INTO track_features (track_id, enrichment_status) VALUES (?, 'pending')",
	);

	const tx = db.transaction((input: HifiTrack[]) => {
		for (const t of input) {
			const trackId = String(t.id);
			if (!trackId) continue;

			if (t.artist?.id) {
				insertArtist.run(
					String(t.artist.id),
					t.artist.name,
					t.artist.popularity ?? null,
					t.artist.picture ?? null,
					toJson(t.artist),
				);
			}

			if (t.album?.id) {
				insertAlbum.run(
					String(t.album.id),
					t.album.title,
					t.album.cover ?? null,
					t.album.vibrantColor ?? null,
					toJson(t.album),
				);
			}

			insertTrack.run(
				trackId,
				t.title,
				t.duration ?? null,
				t.bpm ?? null,
				t.key ?? null,
				t.keyScale ?? null,
				t.popularity ?? null,
				t.explicit ? 1 : 0,
				t.audioQuality ?? null,
				t.isrc ?? null,
				toJson(t.mixes ?? {}),
				toJson(t),
				t.artist?.id ? String(t.artist.id) : null,
				t.album?.id ? String(t.album.id) : null,
			);
			insertFeatures.run(trackId);
		}
	});

	tx(tracks);
}

function getTracksByIdsOrdered(ids: string[]): PoolTrack[] {
	if (!ids.length) return [];
	const db = getDb();
	const placeholders = ids.map(() => "?").join(",");
	const rows = db
		.prepare(
			`SELECT 
				t.id as track_id,
				t.title,
				t.popularity,
				t.artist_id,
				ar.name as artist_name,
				ar.picture_url as artist_picture_url,
				al.title as album_title,
				al.cover_url as cover_url
			FROM tracks t
			LEFT JOIN artists ar ON ar.id = t.artist_id
			LEFT JOIN albums al ON al.id = t.album_id
			WHERE t.id IN (${placeholders})`,
		)
		.all(...ids) as any[];
	const byId = new Map(
		rows.map((row) => [String(row.track_id), toPoolTrack(row)]),
	);
	return ids.map((id) => byId.get(id)).filter(Boolean) as PoolTrack[];
}

async function fetchExternalPopularTracks(
	minCount: number,
): Promise<PoolTrack[]> {
	// Use Last.fm for real trending data instead of keyword searches
	const tracks = await fetchTrendingTracksFallback(minCount * 2);
	if (!tracks.length) return [];

	upsertTracks(tracks);
	const ids = dedupeStrings(tracks.map((t) => String(t.id))).slice(
		0,
		minCount * 2,
	);
	return getTracksByIdsOrdered(ids);
}

async function buildTrackPool(
	userId: string,
	minCount: number,
): Promise<PoolTrack[]> {
	const db = getDb();
	const poolById = new Map<string, PoolTrack>();

	const addTracks = (tracks: PoolTrack[]) => {
		for (const t of tracks) {
			if (!poolById.has(t.trackId)) {
				poolById.set(t.trackId, t);
			}
		}
	};

	const recentRows = db
		.prepare(
			`SELECT DISTINCT t.id as track_id, t.title, t.popularity, t.artist_id, ar.name as artist_name, ar.picture_url as artist_picture_url, al.title as album_title, al.cover_url
			 FROM user_interactions ui
			 JOIN tracks t ON t.id = ui.track_id
			 LEFT JOIN artists ar ON ar.id = t.artist_id
			 LEFT JOIN albums al ON al.id = t.album_id
			 WHERE ui.user_id = ?
			 ORDER BY ui.occurred_at DESC
			 LIMIT 250`,
		)
		.all(userId) as any[];
	addTracks(recentRows.map(toPoolTrack));

	if (getUserInteractionCount(userId) > 0) {
		for (const surface of ["made_for_you", "daily_mix", "radio"] as const) {
			try {
				const recs = await recommend({ userId, surface, limit: 300 });
				const recRows = getTracksByIdsOrdered(recs.map((r) => r.trackId));
				addTracks(recRows);
			} catch {
				// Continue with fallbacks.
			}
		}
	}

	if (poolById.size < minCount) {
		const popularRows = db
			.prepare(
				`SELECT t.id as track_id, t.title, t.popularity, t.artist_id, ar.name as artist_name, ar.picture_url as artist_picture_url, al.title as album_title, al.cover_url
				 FROM tracks t
				 LEFT JOIN artists ar ON ar.id = t.artist_id
				 LEFT JOIN albums al ON al.id = t.album_id
				 ORDER BY t.popularity DESC, t.updated_at DESC
				 LIMIT 600`,
			)
			.all() as any[];
		addTracks(popularRows.map(toPoolTrack));
	}

	if (poolById.size < minCount) {
		addTracks(await fetchExternalPopularTracks(minCount));
	}

	let pool = [...poolById.values()].sort((a, b) => b.popularity - a.popularity);
	if (pool.length > 0) return pool;

	// Absolute fallback for empty databases + external API failure.
	const fallbackCount = Math.max(minCount, 60);
	const fallbackIds = Array.from(
		{ length: fallbackCount },
		(_, i) => `sys-fallback-track-${i + 1}`,
	);
	const insertTrack = db.prepare(
		`INSERT OR IGNORE INTO tracks (id, title, popularity, explicit, created_at, updated_at)
		 VALUES (?, ?, ?, 0, unixepoch(), unixepoch())`,
	);
	const insertFeature = db.prepare(
		"INSERT OR IGNORE INTO track_features (track_id, enrichment_status) VALUES (?, 'pending')",
	);
	const tx = db.transaction(() => {
		fallbackIds.forEach((trackId, i) => {
			insertTrack.run(trackId, `Popular Track ${i + 1}`, 0);
			insertFeature.run(trackId);
		});
	});
	tx();

	pool = getTracksByIdsOrdered(fallbackIds);
	return pool;
}

function persistSystemPlaylist(
	userId: string,
	id: string,
	title: string,
	description: string,
	coverUrl: string | null,
	trackIds: string[],
) {
	const db = getDb();
	const upsertPlaylist = db.prepare(
		`INSERT INTO playlists (id, user_id, title, description, cover_url, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, unixepoch(), unixepoch())
		ON CONFLICT(id) DO UPDATE SET
			user_id = excluded.user_id,
			title = excluded.title,
			description = excluded.description,
			cover_url = excluded.cover_url,
			updated_at = excluded.updated_at`,
	);
	const clearTracks = db.prepare(
		"DELETE FROM playlist_tracks WHERE playlist_id = ?",
	);
	const insertTrack = db.prepare(
		"INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, unixepoch())",
	);

	const tx = db.transaction(() => {
		upsertPlaylist.run(id, userId, title, description, coverUrl);
		clearTracks.run(id);
		trackIds.slice(0, COLLECTION_TRACK_COUNT).forEach((trackId, idx) => {
			insertTrack.run(id, trackId, idx + 1);
		});
	});
	tx();
}

function selectTopArtists(pool: PoolTrack[], count: number): string[] {
	return ensureCount(
		dedupeStrings(pool.map((t) => t.artistName)).slice(0, count),
		count,
		(i) => `Artist ${i + 1}`,
	);
}

function buildMadeForYouTitle(artistName: string, index: number): string {
	return `${artistName} Mix ${index + 1}`;
}

function buildStationTitle(artistName: string): string {
	return `${artistName} Radio`;
}

async function getAlbumsSection(userId: string): Promise<HomepageShelfItem[]> {
	const db = getDb();
	const items: HomepageShelfItem[] = [];
	const seen = new Set<string>();

	const personalized = await getAlbumsForYou(userId, 50).catch(() => []);
	for (const album of personalized) {
		const key = String(album.albumId);
		if (seen.has(key)) continue;
		seen.add(key);
		items.push({
			id: key,
			tidalId: key,
			title: album.title,
			artist: album.artistName,
			imageUrl: normalizeImageUrl(album.coverUrl ?? null),
			type: "album",
		});
		if (items.length >= SECTION_ITEM_COUNT) return items;
	}

	const localRows = db
		.prepare(
			`SELECT 
				al.id, al.title, al.cover_url, ar.name as artist_name
			 FROM albums al
			 LEFT JOIN tracks t ON t.album_id = al.id
			 LEFT JOIN artists ar ON ar.id = t.artist_id
			 GROUP BY al.id
			 ORDER BY MAX(t.popularity) DESC, al.updated_at DESC
			 LIMIT 100`,
		)
		.all() as any[];

	for (const row of localRows) {
		const key = String(row.id);
		if (seen.has(key)) continue;
		seen.add(key);
		items.push({
			id: key,
			tidalId: key,
			title: row.title ?? "Unknown Album",
			artist: row.artist_name ?? null,
			imageUrl: normalizeImageUrl(row.cover_url ?? null),
			type: "album",
		});
		if (items.length >= SECTION_ITEM_COUNT) return items;
	}

	// Use Last.fm for real popular albums instead of keyword search
	try {
		const popularAlbums = await fetchPopularAlbumsFallback(
			SECTION_ITEM_COUNT * 3,
		);
		for (const album of popularAlbums) {
			const key = String(album.id);
			if (seen.has(key)) continue;
			seen.add(key);
			items.push({
				id: key,
				tidalId: key,
				title: album.title ?? "Unknown Album",
				artist: album.artist?.name ?? album.artists?.[0]?.name ?? null,
				imageUrl: normalizeImageUrl(album.cover ?? null),
				type: "album",
			});
			if (items.length >= SECTION_ITEM_COUNT) return items;
		}
	} catch {
		// Keep generated fallback below.
	}

	return ensureCount(items, SECTION_ITEM_COUNT, (i) => ({
		id: `fallback-album-${i + 1}`,
		tidalId: `fallback-album-${i + 1}`,
		title: `Popular Album ${i + 1}`,
		artist: "Muse",
		imageUrl: null,
		type: "album",
	}));
}

async function getArtistsSection(userId: string): Promise<HomepageShelfItem[]> {
	const db = getDb();
	const items: HomepageShelfItem[] = [];
	const seen = new Set<string>();

	const personalized = await getFavouriteArtists(userId, 50).catch(() => []);
	for (const artist of personalized) {
		const key = String(artist.artistId);
		if (seen.has(key)) continue;
		seen.add(key);
		items.push({
			id: key,
			tidalId: key,
			title: artist.name,
			imageUrl: normalizeImageUrl(artist.pictureUrl ?? null),
			type: "artist",
		});
		if (items.length >= SECTION_ITEM_COUNT) return items;
	}

	const localRows = db
		.prepare(
			"SELECT id, name, picture_url FROM artists ORDER BY popularity DESC, updated_at DESC LIMIT 100",
		)
		.all() as any[];
	for (const row of localRows) {
		const key = String(row.id);
		if (seen.has(key)) continue;
		seen.add(key);
		items.push({
			id: key,
			tidalId: key,
			title: row.name ?? "Unknown Artist",
			imageUrl: normalizeImageUrl(row.picture_url ?? null),
			type: "artist",
		});
		if (items.length >= SECTION_ITEM_COUNT) return items;
	}

	// Use Last.fm for real popular artists instead of keyword search
	try {
		const popularArtists = await fetchPopularArtistsFallback(
			SECTION_ITEM_COUNT * 3,
		);
		for (const artist of popularArtists) {
			const key = String(artist.id);
			if (seen.has(key)) continue;
			seen.add(key);
			items.push({
				id: key,
				tidalId: key,
				title: artist.name ?? "Unknown Artist",
				imageUrl: normalizeImageUrl(artist.picture ?? null),
				type: "artist",
			});
			if (items.length >= SECTION_ITEM_COUNT) return items;
		}
	} catch {
		// Keep generated fallback below.
	}

	return ensureCount(items, SECTION_ITEM_COUNT, (i) => ({
		id: `fallback-artist-${i + 1}`,
		tidalId: `fallback-artist-${i + 1}`,
		title: `Popular Artist ${i + 1}`,
		imageUrl: null,
		type: "artist",
	}));
}

export async function buildHomepageShelvesForExternalUser(
	externalId: string,
): Promise<{
	userId: string;
	generatedAt: number;
	shelves: HomepageShelf[];
}> {
	const user = resolveOrCreateUser(externalId);
	const pool = await buildTrackPool(user.id, 180);
	const poolIds = pool.map((t) => t.trackId);
	const poolById = new Map(pool.map((t) => [t.trackId, t]));
	const topArtists = selectTopArtists(pool, 20);
	const daySeed = `${externalId}:${new Date().toISOString().slice(0, 10)}`;
	const baseOffset = stableOffset(daySeed, Math.max(poolIds.length, 1));

	const madeForYou: HomepageShelfItem[] = [];
	const stations: HomepageShelfItem[] = [];

	for (let i = 0; i < SECTION_ITEM_COUNT; i++) {
		const artist = topArtists[i % topArtists.length];
		const mixId = `sys-mix-${externalId}-${i + 1}`;
		const mixTitle = buildMadeForYouTitle(artist, i);
		const mixTrackIds = pickTrackIds(
			poolIds,
			baseOffset + i * 17,
			COLLECTION_TRACK_COUNT,
		);
		const mixCover =
			pickDominantArtistCover(mixTrackIds, poolById) ??
			poolById.get(mixTrackIds[0])?.coverUrl ??
			null;
		persistSystemPlaylist(
			user.id,
			mixId,
			mixTitle,
			"System generated mix",
			mixCover,
			mixTrackIds,
		);
		madeForYou.push({
			id: mixId,
			tidalId: mixId,
			title: mixTitle,
			artist,
			imageUrl: mixCover,
			type: "mix",
			songs: COLLECTION_TRACK_COUNT,
		});

		const stationArtist = topArtists[(i + 3) % topArtists.length];
		const stationId = `sys-playlist-${externalId}-${i + 1}`;
		const stationTitle = buildStationTitle(stationArtist);
		const stationTrackIds = pickTrackIds(
			poolIds,
			baseOffset + i * 23 + 5,
			COLLECTION_TRACK_COUNT,
		);
		const stationCover =
			pickDominantArtistCover(stationTrackIds, poolById) ??
			poolById.get(stationTrackIds[0])?.coverUrl ??
			null;
		persistSystemPlaylist(
			user.id,
			stationId,
			stationTitle,
			"System generated station",
			stationCover,
			stationTrackIds,
		);
		stations.push({
			id: stationId,
			tidalId: stationId,
			title: stationTitle,
			artist: stationArtist,
			imageUrl: stationCover,
			type: "playlist",
			songs: COLLECTION_TRACK_COUNT,
		});
	}

	const [albums, artists] = await Promise.all([
		getAlbumsSection(user.id),
		getArtistsSection(user.id),
	]);

	return {
		userId: externalId,
		generatedAt: Date.now(),
		shelves: [
			{ title: "Made For You", type: "mixes", items: madeForYou },
			{ title: "Recommended Stations", type: "playlists", items: stations },
			{
				title: "Albums For You",
				type: "albums",
				items: albums.slice(0, SECTION_ITEM_COUNT),
			},
			{
				title: "Featured Artists",
				type: "artists",
				items: artists.slice(0, SECTION_ITEM_COUNT),
			},
		],
	};
}

function extractTopValuesFromJsonArrays(
	values: any[],
	limit: number,
): string[] {
	const counts = new Map<string, number>();
	for (const value of values) {
		const arr = fromJson<string[]>(value, []);
		for (const item of arr) {
			const key = (item ?? "").trim();
			if (!key) continue;
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
	}
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([key]) => key)
		.slice(0, limit);
}

export async function buildDynamicSearchSections(): Promise<{
	categories: Array<{ title: string; items: string[] }>;
}> {
	const db = getDb();

	const discoverItemsRaw = db
		.prepare(
			`SELECT DISTINCT title
			 FROM playlists
			 ORDER BY updated_at DESC
			 LIMIT 40`,
		)
		.all() as Array<{ title: string }>;
	const discoverItems = ensureCount(
		dedupeStrings(discoverItemsRaw.map((r) => r.title)).slice(
			0,
			SECTION_ITEM_COUNT,
		),
		SECTION_ITEM_COUNT,
		(i) => `Discover Pick ${i + 1}`,
	);

	const genreRows = db
		.prepare(
			`SELECT genre, COUNT(*) as c
			 FROM track_features
			 WHERE genre IS NOT NULL AND genre != ''
			 GROUP BY genre
			 ORDER BY c DESC
			 LIMIT 50`,
		)
		.all() as Array<{ genre: string }>;
	const genres = ensureCount(
		dedupeStrings(genreRows.map((r) => r.genre)).slice(0, SECTION_ITEM_COUNT),
		SECTION_ITEM_COUNT,
		(i) => `Genre ${i + 1}`,
	);

	const moodRows = db
		.prepare(
			"SELECT mood_tags FROM track_features WHERE mood_tags IS NOT NULL LIMIT 400",
		)
		.all() as Array<{ mood_tags: string }>;
	const moodItems = ensureCount(
		extractTopValuesFromJsonArrays(
			moodRows.map((r) => r.mood_tags),
			SECTION_ITEM_COUNT,
		),
		SECTION_ITEM_COUNT,
		(i) => `Mood ${i + 1}`,
	);

	const themeRows = db
		.prepare("SELECT genres FROM artists WHERE genres IS NOT NULL LIMIT 400")
		.all() as Array<{ genres: string }>;
	const themes = ensureCount(
		extractTopValuesFromJsonArrays(
			themeRows.map((r) => r.genres),
			SECTION_ITEM_COUNT,
		),
		SECTION_ITEM_COUNT,
		(i) => `Collection ${i + 1}`,
	);

	return {
		categories: [
			{ title: "Discover", items: discoverItems.slice(0, SECTION_ITEM_COUNT) },
			{ title: "Genres", items: genres.slice(0, SECTION_ITEM_COUNT) },
			{
				title: "Mood & Activity",
				items: moodItems.slice(0, SECTION_ITEM_COUNT),
			},
			{
				title: "Themes & Collections",
				items: themes.slice(0, SECTION_ITEM_COUNT),
			},
		],
	};
}
