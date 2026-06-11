import { Prisma, type User } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { fromJson } from "../db/helpers.js";
import { ensureUser } from "../db/repositories/users.js";
import { upsertHifiTrack } from "../db/repositories/catalog.js";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { isCompilationArtist } from "./artistFilters.js";
import { hifiClient, type HifiTrack } from "./hifiClient.js";
import { lastfmClient } from "./lastfmClient.js";
import {
	recommend,
	getAlbumsForYou,
	getFavouriteArtists,
} from "./recommender.js";
import {
	fetchTrendingTracksFallback,
	fetchPopularArtistsFallback,
	fetchPopularAlbumsFallback,
	searchTidalArtist,
	searchTidalTrack,
} from "./popularityService.js";

const log = logger.child({ scope: "homepage" });
const SECTION_ITEM_COUNT = config.sectionItemCount;
const COLLECTION_TRACK_COUNT = config.collectionTrackCount;

function normalizeImageUrl(
	value: string | null | undefined,
	type: "square" | "video" = "square",
): string | null {
	if (!value) return null;

	// If it's a Tidal URL, always pass through the proxy (hifiClient handles slug extraction)
	if (typeof value === "string" && value.includes("tidal.com/images/")) {
		return hifiClient.tidalImageUrl(value, 640, type);
	}

	// Return other absolute URLs as-is
	if (
		value.startsWith("http://") ||
		value.startsWith("https://") ||
		value.startsWith("/") ||
		value.startsWith("blob:") ||
		value.startsWith("assets/")
	) {
		return value;
	}

	// For raw picture IDs, use the proxy
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
	artistImages?: string[];
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

async function getUserInteractionCount(userId: string): Promise<number> {
	return prisma.userInteraction.count({ where: { userId } });
}

export async function resolveOrCreateUser(externalId: string): Promise<User> {
	// New homepage users are provisioned with the external id as their id.
	return ensureUser(externalId, externalId, 1);
}

async function upsertTracks(tracks: HifiTrack[]): Promise<void> {
	for (const t of tracks) {
		if (!String(t.id)) continue;
		await upsertHifiTrack(t);
	}
}

async function getTracksByIdsOrdered(ids: string[]): Promise<PoolTrack[]> {
	if (!ids.length) return [];
	const rows = await prisma.$queryRaw<any[]>`
		SELECT
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
		WHERE t.id IN (${Prisma.join(ids)})`;
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

	await upsertTracks(tracks);
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
	const poolById = new Map<string, PoolTrack>();

	const addTracks = (tracks: PoolTrack[]) => {
		for (const t of tracks) {
			if (!poolById.has(t.trackId)) {
				poolById.set(t.trackId, t);
			}
		}
	};

	const recentRows = await prisma.$queryRaw<any[]>`
		SELECT DISTINCT t.id as track_id, t.title, t.popularity, t.artist_id, ar.name as artist_name, ar.picture_url as artist_picture_url, al.title as album_title, al.cover_url
		 FROM user_interactions ui
		 JOIN tracks t ON t.id = ui.track_id
		 LEFT JOIN artists ar ON ar.id = t.artist_id
		 LEFT JOIN albums al ON al.id = t.album_id
		 WHERE ui.user_id = ${userId}
		 ORDER BY ui.occurred_at DESC
		 LIMIT 250`;
	addTracks(recentRows.map(toPoolTrack));

	if ((await getUserInteractionCount(userId)) > 0) {
		for (const surface of ["made_for_you", "daily_mix", "radio"] as const) {
			try {
				const recs = await recommend({ userId, surface, limit: 300 });
				const recRows = await getTracksByIdsOrdered(recs.map((r) => r.trackId));
				addTracks(recRows);
			} catch {
				// Continue with fallbacks.
			}
		}
	}

	if (poolById.size < minCount) {
		const popularRows = await prisma.$queryRaw<any[]>`
			SELECT t.id as track_id, t.title, t.popularity, t.artist_id, ar.name as artist_name, ar.picture_url as artist_picture_url, al.title as album_title, al.cover_url
			 FROM tracks t
			 LEFT JOIN artists ar ON ar.id = t.artist_id
			 LEFT JOIN albums al ON al.id = t.album_id
			 ORDER BY t.popularity DESC, t.updated_at DESC
			 LIMIT 600`;
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
	await prisma.$transaction(
		fallbackIds.flatMap((trackId, i) => [
			prisma.track.upsert({
				where: { id: trackId },
				create: {
					id: trackId,
					title: `Popular Track ${i + 1}`,
					popularity: 0,
					explicit: 0,
				},
				update: {},
			}),
			prisma.trackFeatures.upsert({
				where: { trackId },
				create: { trackId, enrichmentStatus: "pending" },
				update: {},
			}),
		]),
	);

	pool = await getTracksByIdsOrdered(fallbackIds);
	return pool;
}

async function persistSystemPlaylist(
	userId: string,
	id: string,
	title: string,
	description: string,
	coverUrl: string | null,
	trackIds: string[],
): Promise<void> {
	const nowSec = Math.floor(Date.now() / 1000);
	const sliced = trackIds.slice(0, COLLECTION_TRACK_COUNT);
	await prisma.$transaction([
		prisma.playlist.upsert({
			where: { id },
			create: { id, userId, title, description, coverUrl },
			update: { userId, title, description, coverUrl, updatedAt: nowSec },
		}),
		prisma.playlistTrack.deleteMany({ where: { playlistId: id } }),
		...(sliced.length
			? [
					prisma.playlistTrack.createMany({
						data: sliced.map((trackId, idx) => ({
							playlistId: id,
							trackId,
							position: idx + 1,
						})),
					}),
				]
			: []),
	]);
}

function selectTopArtists(
	pool: PoolTrack[],
	count: number,
): Array<{ name: string; id: string | null; imageUrl: string | null }> {
	// Aggregate artist data from pool tracks
	const artistMap = new Map<
		string,
		{ name: string; id: string | null; imageUrl: string | null; count: number }
	>();

	for (const track of pool) {
		if (!track.artistId || !track.artistName) continue;
		if (isCompilationArtist(track.artistName)) continue;
		const existing = artistMap.get(track.artistId);
		if (existing) {
			existing.count += 1;
			if (!existing.imageUrl && track.artistImageUrl) {
				existing.imageUrl = track.artistImageUrl;
			}
		} else {
			artistMap.set(track.artistId, {
				name: track.artistName,
				id: track.artistId,
				imageUrl: track.artistImageUrl,
				count: 1,
			});
		}
	}

	// Sort by frequency (most popular first) and take top count
	const sortedArtists = [...artistMap.values()]
		.sort((a, b) => b.count - a.count)
		.slice(0, count);

	return ensureCount(
		sortedArtists.map((a) => ({
			name: a.name,
			id: a.id,
			imageUrl: a.imageUrl,
		})),
		count,
		(i) => ({ name: `Artist ${i + 1}`, id: null, imageUrl: null }),
	);
}

/**
 * Real artists to anchor the "<Artist> Mix" shelf — the user's favourite
 * artists when they have history, otherwise Last.fm chart artists (the same
 * high-quality source as Featured Artists). Compilation/various-artist pseudo
 * names are filtered out, with a pool-frequency fallback only if needed.
 */
async function getAnchorArtists(
	userId: string,
	pool: PoolTrack[],
	count: number,
): Promise<
	Array<{ name: string; id: string | null; imageUrl: string | null }>
> {
	const out: Array<{
		name: string;
		id: string | null;
		imageUrl: string | null;
	}> = [];
	const seen = new Set<string>();

	const add = (name: string, id: string | null, imageUrl: string | null) => {
		const key = name.trim().toLowerCase();
		if (!key || seen.has(key) || isCompilationArtist(name)) return;
		seen.add(key);
		out.push({ name: name.trim(), id, imageUrl });
	};

	try {
		const favourites = await getFavouriteArtists(userId, count * 2);
		for (const fav of favourites) {
			if (out.length >= count) break;
			add(
				fav.name,
				fav.artistId != null ? String(fav.artistId) : null,
				normalizeImageUrl(fav.pictureUrl ?? null),
			);
		}
	} catch {
		// Fall back to pool-derived artists below.
	}

	// Top up from the (already compilation-filtered) pool if we're short.
	if (out.length < count) {
		for (const artist of selectTopArtists(pool, count * 2)) {
			if (out.length >= count) break;
			add(artist.name, artist.id, artist.imageUrl);
		}
	}

	return ensureCount(out, count, (i) => ({
		name: `Artist ${i + 1}`,
		id: null,
		imageUrl: null,
	}));
}

function buildMadeForYouTitle(artistName: string, _index: number): string {
	return `${artistName} Mix`;
}

/**
 * Order a mix's tracks so the named artist anchors it: that artist's own pool
 * tracks first, then the rest of the (similarity-derived) pool for discovery.
 * Pure local selection — no API calls — so it's safe on the request path.
 */
function pickArtistAnchoredTrackIds(
	artistId: string | null,
	poolIds: string[],
	poolById: Map<string, PoolTrack>,
	offset: number,
	count: number,
): string[] {
	const own: string[] = [];
	if (artistId) {
		for (const id of poolIds) {
			if (poolById.get(id)?.artistId === artistId) own.push(id);
		}
	}
	const rest = pickTrackIds(poolIds, offset, count + own.length);
	const ordered: string[] = [];
	const seen = new Set<string>();
	for (const id of [...own, ...rest]) {
		if (seen.has(id)) continue;
		seen.add(id);
		ordered.push(id);
		if (ordered.length >= count) break;
	}
	return ordered;
}

/**
 * Bounded Last.fm expansion for an artist mix: the artist's top tracks plus a
 * few similar artists' top tracks, resolved to playable Tidal tracks and
 * persisted. Returns the new track IDs. Expensive (network) — only run during
 * worker precompute, never on the request path.
 */
const MIX_SIMILAR_ARTISTS = 3;
const MIX_ENRICH_TIDAL_CAP = 24;

async function enrichArtistMixTrackIds(artistName: string): Promise<string[]> {
	if (!artistName) return [];
	try {
		const [own, similar] = await Promise.all([
			lastfmClient.getArtistTopTracks(artistName, 12),
			lastfmClient.getSimilarArtists(artistName, MIX_SIMILAR_ARTISTS),
		]);

		const candidates = own.map((t) => ({
			title: t.name,
			artist: t.artist?.name ?? artistName,
		}));

		const similarTop = await Promise.allSettled(
			similar
				.slice(0, MIX_SIMILAR_ARTISTS)
				.map((sa) => lastfmClient.getArtistTopTracks(sa.name, 6)),
		);
		for (const result of similarTop) {
			if (result.status !== "fulfilled") continue;
			for (const t of result.value) {
				candidates.push({
					title: t.name,
					artist: t.artist?.name ?? "",
				});
			}
		}

		const resolved: HifiTrack[] = [];
		const pool = candidates.slice(0, MIX_ENRICH_TIDAL_CAP);
		const batchSize = config.tidalResolveBatch;
		for (let i = 0; i < pool.length; i += batchSize) {
			const batch = pool.slice(i, i + batchSize);
			const settled = await Promise.allSettled(
				batch.map((c) => searchTidalTrack(c.title, c.artist)),
			);
			for (const s of settled) {
				if (s.status === "fulfilled" && s.value) resolved.push(s.value);
			}
		}

		if (!resolved.length) return [];
		await upsertTracks(resolved);
		return dedupeStrings(resolved.map((t) => String(t.id)));
	} catch {
		return [];
	}
}

function buildGenreMixTitle(genre: string): string {
	return `${genre} Mix`;
}

// Last.fm responses are cached in lastfmClient (SQLite), so no in-memory tag
// cache is needed here.
function formatTagNames(names: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const name of names) {
		const formatted = name
			.split(/[-\s]+/)
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(" ")
			.trim();
		const key = formatted.toLowerCase();
		if (!formatted || seen.has(key)) continue;
		seen.add(key);
		out.push(formatted);
	}
	return out;
}

/**
 * Names of the artists a user most strongly engages with, drawn from their
 * interactions and saved library. Used to derive a genre profile from
 * Last.fm's artist.getTopTags when local track-feature genres are sparse.
 */
async function getSeedArtistNames(
	userId: string,
	limit: number,
): Promise<string[]> {
	const rows = await prisma.$queryRaw<Array<{ name: string }>>`
		SELECT ar.name as name,
			SUM(CASE WHEN ui.event_type IN ('like','save','follow','repeat','playlist_add') THEN 3
					 WHEN ui.event_type = 'play' THEN 1
					 WHEN ui.event_type = 'skip' THEN -1 ELSE 0 END) as score
		 FROM user_interactions ui
		 JOIN artists ar ON ar.id = ui.artist_id
		 WHERE ui.user_id = ${userId} AND ar.name IS NOT NULL AND ar.name != ''
		 GROUP BY ar.id
		 ORDER BY score DESC
		 LIMIT ${limit}`;
	return dedupeStrings(rows.map((r) => r.name));
}

async function getTopGenreTags(
	userId: string,
	count: number,
): Promise<string[]> {
	// New users (no activity at all): trending genres from Last.fm charts.
	if ((await getUserInteractionCount(userId)) === 0) {
		try {
			const tags = await lastfmClient.getTopTags(50);
			const formatted = formatTagNames(tags.map((t) => t.name));
			if (formatted.length) return formatted.slice(0, count);
		} catch (error) {
			log.error(
				{ err: error },
				"Failed to fetch top tags from Last.fm for new user",
			);
			// Fall through to DB fallback
		}
	}

	// Old users (or fallback): get top genres from DB based on user's listening history
	try {
		const genreRows = await prisma.$queryRaw<Array<{ genre: string }>>`
			SELECT tf.genre, COUNT(*) as c
			 FROM track_features tf
			 JOIN user_interactions ui ON ui.track_id = tf.track_id
			 WHERE ui.user_id = ${userId} AND tf.genre IS NOT NULL AND tf.genre != ''
			 GROUP BY tf.genre
			 ORDER BY c DESC
			 LIMIT ${count * 2}`;

		if (genreRows.length > 0) {
			return dedupeStrings(genreRows.map((r) => r.genre)).slice(0, count);
		}

		// Track features are sparse (enrichment hasn't caught up): derive the
		// user's genres from their favourite artists' Last.fm tags.
		const seedArtists = await getSeedArtistNames(userId, 8);
		if (seedArtists.length) {
			const tagCounts = new Map<string, number>();
			const tagLists = await Promise.allSettled(
				seedArtists.map((name) => lastfmClient.getArtistTopTags(name, 5)),
			);
			for (const result of tagLists) {
				if (result.status !== "fulfilled") continue;
				for (const tag of result.value) {
					tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
				}
			}
			if (tagCounts.size) {
				const ranked = [...tagCounts.entries()]
					.sort((a, b) => b[1] - a[1])
					.map(([tag]) => tag);
				const formatted = formatTagNames(ranked);
				if (formatted.length) return formatted.slice(0, count);
			}
		}

		// If no user history, fall back to global DB genres
		const globalGenreRows = await prisma.$queryRaw<Array<{ genre: string }>>`
			SELECT genre, COUNT(*) as c
			 FROM track_features
			 WHERE genre IS NOT NULL AND genre != ''
			 GROUP BY genre
			 ORDER BY c DESC
			 LIMIT ${count}`;

		return dedupeStrings(globalGenreRows.map((r) => r.genre)).slice(0, count);
	} catch (error) {
		log.error({ err: error }, "Failed to fetch genres from DB");
		// Final fallback: return some default genres
		return [
			"Rock",
			"Pop",
			"Hip Hop",
			"Electronic",
			"Indie",
			"R&B",
			"Jazz",
			"Classical",
			"Metal",
			"Folk",
		].slice(0, count);
	}
}

/**
 * Generate genre mix cover using the top artist's image (same approach as artist mixes)
 */
async function generateGenreMixCover(tag: string): Promise<string | null> {
	try {
		// Get top artists for this tag from Last.fm
		const topArtists = await lastfmClient.getTopArtistsByTag(tag, 10);
		if (!topArtists.length) {
			log.warn({ tag }, "No artists found for tag");
			return null;
		}

		// Find the first artist with a valid Tidal image
		for (const lfArtist of topArtists) {
			try {
				const tidalArtist = await searchTidalArtist(lfArtist.name);
				if (tidalArtist?.picture) {
					return normalizeImageUrl(tidalArtist.picture);
				}
			} catch {
				// Continue to next artist if search fails
			}
		}

		log.warn({ tag }, "No Tidal images found for any artist in mix");
		return null;
	} catch (error) {
		log.error({ err: error, tag }, "Failed to generate cover for tag");
		return null;
	}
}

/**
 * Get tag info from Last.fm for genre mix description
 */
async function getGenreMixDescription(tag: string): Promise<string> {
	try {
		const tagInfo = await lastfmClient.getTagInfo(tag);
		if (tagInfo?.wiki?.summary) {
			// Strip HTML tags and truncate
			const cleanSummary = tagInfo.wiki.summary
				.replace(/<[^>]*>/g, "")
				.substring(0, 200);
			return cleanSummary || `A mix of ${tag} music`;
		}
	} catch {
		// Fall through to default
	}
	return `A mix of ${tag} music`;
}

function buildStationTitle(artistName: string): string {
	return `${artistName} Radio`;
}

async function getAlbumsSection(userId: string): Promise<HomepageShelfItem[]> {
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

	const localRows = await prisma.$queryRaw<any[]>`
		SELECT
			al.id, al.title, al.cover_url, ar.name as artist_name
		 FROM albums al
		 LEFT JOIN tracks t ON t.album_id = al.id
		 LEFT JOIN artists ar ON ar.id = t.artist_id
		 GROUP BY al.id
		 ORDER BY MAX(t.popularity) DESC, al.updated_at DESC
		 LIMIT 100`;

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
	const items: HomepageShelfItem[] = [];
	const seen = new Set<string>();

	const personalized = await getFavouriteArtists(userId, 50).catch(() => []);
	for (const artist of personalized) {
		const key = String(artist.artistId);
		if (seen.has(key) || isCompilationArtist(artist.name)) continue;
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

	const localRows = await prisma.artist.findMany({
		orderBy: [{ popularity: "desc" }, { updatedAt: "desc" }],
		take: 100,
		select: { id: true, name: true, pictureUrl: true },
	});
	for (const row of localRows) {
		const key = String(row.id);
		if (seen.has(key) || isCompilationArtist(row.name)) continue;
		seen.add(key);
		items.push({
			id: key,
			tidalId: key,
			title: row.name ?? "Unknown Artist",
			imageUrl: normalizeImageUrl(row.pictureUrl ?? null),
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
	options: { enrich?: boolean } = {},
): Promise<{
	userId: string;
	generatedAt: number;
	shelves: HomepageShelf[];
}> {
	// `enrich` runs the heavy Last.fm + Tidal expansion (artist-centered mixes).
	// The worker passes true; the request-path fallback passes false to stay fast.
	const enrich = options.enrich ?? false;
	const user = await resolveOrCreateUser(externalId);
	const pool = await buildTrackPool(user.id, config.trackPoolSize);
	const poolIds = pool.map((t) => t.trackId);
	const poolById = new Map(pool.map((t) => [t.trackId, t]));
	const topArtists = await getAnchorArtists(user.id, pool, 20);
	const daySeed = `${externalId}:${new Date().toISOString().slice(0, 10)}`;
	const baseOffset = stableOffset(daySeed, Math.max(poolIds.length, 1));

	// Cross-shelf dedup: a track used to anchor one mix shouldn't dominate the next.
	const usedTrackIds = new Set<string>();

	const madeForYou: HomepageShelfItem[] = [];
	const genreMixes: HomepageShelfItem[] = [];

	for (let i = 0; i < SECTION_ITEM_COUNT; i++) {
		const artist = topArtists[i % topArtists.length];
		const mixId = `sys-mix-${externalId}-${i + 1}`;
		const mixTitle = buildMadeForYouTitle(artist.name, i);

		// Center the mix on its artist using the (similarity-derived) pool, then
		// top up with a bounded Last.fm expansion when enriching.
		let candidateIds = pickArtistAnchoredTrackIds(
			artist.id,
			poolIds,
			poolById,
			baseOffset + i * 17,
			COLLECTION_TRACK_COUNT,
		);

		if (enrich) {
			const enriched = await enrichArtistMixTrackIds(artist.name);
			if (enriched.length) {
				const merged: string[] = [];
				const seen = new Set<string>();
				for (const id of [...enriched, ...candidateIds]) {
					if (seen.has(id)) continue;
					seen.add(id);
					merged.push(id);
				}
				candidateIds = merged;
			}
		}

		// Prefer tracks not already spent on an earlier mix (soft dedup).
		const fresh = candidateIds.filter((id) => !usedTrackIds.has(id));
		const mixTrackIds = (
			fresh.length >= COLLECTION_TRACK_COUNT ? fresh : candidateIds
		).slice(0, COLLECTION_TRACK_COUNT);
		mixTrackIds.forEach((id) => usedTrackIds.add(id));

		// Use the artist's image directly for the mix cover
		const mixCover =
			normalizeImageUrl(artist.imageUrl) ??
			poolById.get(mixTrackIds[0])?.coverUrl ??
			null;
		await persistSystemPlaylist(
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
			artist: artist.name,
			imageUrl: mixCover,
			type: "mix",
			songs: COLLECTION_TRACK_COUNT,
		});
	}

	// Get top genre tags from Last.fm and create genre mixes
	try {
		let topGenres = await getTopGenreTags(user.id, SECTION_ITEM_COUNT);

		// If no local genres available, fetch directly from Last.fm chart.getTopTags
		if (topGenres.length === 0) {
			log.debug("No local genres, fetching from Last.fm chart.getTopTags");
			const tags = await lastfmClient.getTopTags(SECTION_ITEM_COUNT);
			// Format tags: capitalize first letter of each word
			topGenres = tags.map((t) =>
				t.name
					.split(/[-\s]+/)
					.map(
						(word: string) =>
							word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
					)
					.join(" "),
			);
			// Filter duplicates
			const seen = new Set<string>();
			topGenres = topGenres.filter((tag) => {
				const key = tag.toLowerCase();
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			});
		}

		// Build genre mixes - we now always have genres (from local DB or Last.fm)
		for (let i = 0; i < SECTION_ITEM_COUNT; i++) {
			const genre = topGenres[i % topGenres.length];
			const genreMixId = `sys-genre-${externalId}-${i + 1}`;
			const genreMixTitle = buildGenreMixTitle(genre);

			// Generate cover from Last.fm tag.getTopArtists
			const genreCover = await generateGenreMixCover(genre);

			// Get description from Last.fm tag.getInfo
			const genreDescription = await getGenreMixDescription(genre);

			// For genre mixes, we don't store track IDs - they are fetched dynamically
			// from Last.fm tag.getTopTracks when the playlist is accessed
			await persistSystemPlaylist(
				user.id,
				genreMixId,
				genreMixTitle,
				genreDescription,
				genreCover,
				[], // Empty track IDs - fetched dynamically
			);
			genreMixes.push({
				id: genreMixId,
				tidalId: genreMixId,
				title: genreMixTitle,
				artist: genre,
				imageUrl: genreCover,
				type: "playlist",
				songs: COLLECTION_TRACK_COUNT,
			});
		}
	} catch (error) {
		log.error({ err: error }, "Failed to build genre mixes");
		// Genre mixes section will be empty - homepage will still have other sections
	}

	const [albums, artists] = await Promise.all([
		getAlbumsSection(user.id),
		getArtistsSection(user.id),
	]);

	return {
		userId: externalId,
		generatedAt: Date.now(),
		shelves: [
			{ title: "Artists Mixes", type: "mixes", items: madeForYou },
			{ title: "Genre Mixes", type: "playlists", items: genreMixes },
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
	const discoverItemsRaw = await prisma.$queryRaw<Array<{ title: string }>>`
		SELECT DISTINCT title
		 FROM playlists
		 ORDER BY updated_at DESC
		 LIMIT 40`;
	const discoverItems = ensureCount(
		dedupeStrings(discoverItemsRaw.map((r) => r.title)).slice(
			0,
			SECTION_ITEM_COUNT,
		),
		SECTION_ITEM_COUNT,
		(i) => `Discover Pick ${i + 1}`,
	);

	const genreRows = await prisma.$queryRaw<Array<{ genre: string }>>`
		SELECT genre, COUNT(*) as c
		 FROM track_features
		 WHERE genre IS NOT NULL AND genre != ''
		 GROUP BY genre
		 ORDER BY c DESC
		 LIMIT 50`;
	const genres = ensureCount(
		dedupeStrings(genreRows.map((r) => r.genre)).slice(0, SECTION_ITEM_COUNT),
		SECTION_ITEM_COUNT,
		(i) => `Genre ${i + 1}`,
	);

	const moodRows = await prisma.$queryRaw<Array<{ mood_tags: string }>>`
		SELECT mood_tags FROM track_features WHERE mood_tags IS NOT NULL LIMIT 400`;
	const moodItems = ensureCount(
		extractTopValuesFromJsonArrays(
			moodRows.map((r) => r.mood_tags),
			SECTION_ITEM_COUNT,
		),
		SECTION_ITEM_COUNT,
		(i) => `Mood ${i + 1}`,
	);

	const themeRows = await prisma.$queryRaw<Array<{ genres: string }>>`
		SELECT genres FROM artists WHERE genres IS NOT NULL LIMIT 400`;
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
