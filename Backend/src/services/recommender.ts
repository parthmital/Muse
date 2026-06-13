/**
 * src/services/recommender.ts
 *
 * Last.fm-based recommendation engine.
 *
 * Personalised recommendations are generated from the user's listening seeds
 * (recent plays, likes, and library tracks) via Last.fm's content-similarity
 * endpoints (track.getSimilar / artist.getSimilar -> artist.getTopTracks).
 * Candidates are mapped to playable Tidal tracks, de-duplicated, capped per
 * artist for diversity, and ranked by Last.fm similarity + popularity.
 *
 * New users (no seeds) fall back to Last.fm charts via genericRecs().
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { fromJson, toJson } from "../db/helpers.js";
import {
	upsertHifiTrack,
	upsertAlbumBasic,
} from "../db/repositories/catalog.js";
import {
	recCache,
	recCacheKey,
	type RecommendedTrack,
} from "../cache/index.js";
import type {
	RecommendedArtist,
	RecommendedAlbum,
	RecommendedMix,
} from "../cache/index.js";
import { getProfile } from "./profileBuilder.js";
import { config } from "../config.js";
import { lastfmClient } from "./lastfmClient.js";
import {
	searchTidalTrack,
	searchTidalAlbum,
	fetchTrendingTracksFallback,
	fetchPopularArtistsFallback,
	type EnrichedTrack,
} from "./popularityService.js";

// ── Tuning ───────────────────────────────────────────────────────────────────
const SEED_TRACK_CAP = config.seedTrackCap; // seed tracks expanded via track.getSimilar
const SEED_ARTIST_CAP = config.seedArtistCap; // seed artists expanded via artist.getSimilar
const SIMILAR_PER_TRACK = config.similarPerTrack; // similar tracks per seed track
const MAX_TIDAL_LOOKUPS = config.maxTidalLookups; // hard cap on Tidal resolution calls
const SIMILAR_ARTISTS = 8; // similar artists fetched per seed artist
const TOP_TRACKS_PER_ARTIST = 10; // top tracks fetched per similar artist
const MAX_PER_ARTIST = 2; // diversity: max tracks from one artist in the result

// ── Surface limits ─────────────────────────────────────────────────────────────
function surfaceLimit(surface: string, override?: number): number {
	if (override) return override;
	return (
		{
			queue: config.queueSize,
			home: config.homeRecCount,
			discover: config.mixTrackCount,
			daily_mix: config.mixTrackCount,
			radio: config.queueSize,
		}[surface] ?? 20
	);
}

// ── Main entry ─────────────────────────────────────────────────────────────────
export async function recommend(opts: {
	userId: string;
	surface: string;
	seedTrackId?: string | null;
	limit?: number;
	excludeIds?: string[];
}): Promise<RecommendedTrack[]> {
	const { userId, surface, seedTrackId, excludeIds = [] } = opts;
	const limit = surfaceLimit(surface, opts.limit);
	const cacheKey = recCacheKey(userId, surface);
	const cached = recCache.get(cacheKey);
	if (cached) return cached;

	const [recentlyPlayed, overexposed] = await Promise.all([
		recentlyPlayedIds(userId),
		// Over-exposed items (shown repeatedly without engagement) are excluded so
		// the surface keeps moving instead of going stale.
		overexposedTrackIds(userId),
	]);
	const exclude = new Set<string>([
		...excludeIds,
		...recentlyPlayed,
		...overexposed,
	]);

	// Gather listening seeds (optionally biased toward an explicit seed track).
	const seeds = await getUserSeeds(userId, seedTrackId);

	if (!seeds.tracks.length && !seeds.artists.length) {
		const generic = await genericRecs(limit, [...exclude]);
		recCache.set(cacheKey, generic);
		return generic;
	}

	const candidates = await gatherLastfmCandidates(seeds);

	// Negative signal: down-weight candidates by artists the user recently skipped.
	const skipped = await recentlySkippedArtistNames(userId);
	if (skipped.size) {
		for (const c of candidates) {
			if (skipped.has(c.artist.trim().toLowerCase())) c.score *= 0.25;
		}
		candidates.sort((a, b) => b.score - a.score);
	}

	if (!candidates.length) {
		const generic = await genericRecs(limit, [...exclude]);
		recCache.set(cacheKey, generic);
		return generic;
	}

	const result = await resolveCandidates(candidates, limit, exclude);

	// If Last.fm/Tidal resolution came up short, top up with generic charts.
	if (result.length < limit) {
		const have = new Set(result.map((r) => r.trackId));
		const filler = await genericRecs(limit - result.length, [
			...exclude,
			...have,
		]);
		for (const f of filler) {
			if (!have.has(f.trackId)) {
				result.push(f);
				have.add(f.trackId);
			}
		}
	}

	const final = result.slice(0, limit);
	recCache.set(cacheKey, final);
	return final;
}

// ── Seeds ───────────────────────────────────────────────────────────────────────
type SeedTrack = { id: string; title: string; artist: string };

async function getUserSeeds(
	userId: string,
	seedTrackId?: string | null,
): Promise<{ tracks: SeedTrack[]; artists: string[] }> {
	// Weighted recent interactions (likes/saves/repeats rank above plays).
	const rows = await prisma.$queryRaw<SeedTrack[]>`
		SELECT t.id as id, t.title as title, MAX(ar.name) as artist,
			MAX(ui.occurred_at) as last_at,
			SUM(CASE WHEN ui.event_type IN ('like','save','repeat','playlist_add') THEN 3
					 WHEN ui.event_type = 'play' THEN 1 ELSE 0 END) as weight
		 FROM user_interactions ui
		 JOIN tracks t ON t.id = ui.track_id
		 JOIN artists ar ON ar.id = t.artist_id
		 WHERE ui.user_id = ${userId} AND ui.track_id IS NOT NULL
		   AND ar.name IS NOT NULL AND ar.name != ''
		 GROUP BY t.id
		 ORDER BY weight DESC, last_at DESC
		 LIMIT 40`;

	// Saved library tracks (no interaction required).
	const libRows = await prisma.$queryRaw<SeedTrack[]>`
		SELECT t.id as id, t.title as title, ar.name as artist
		 FROM user_library ul
		 JOIN tracks t ON t.id = ul.item_id
		 JOIN artists ar ON ar.id = t.artist_id
		 WHERE ul.user_id = ${userId} AND ul.item_type = 'track'
		   AND ar.name IS NOT NULL AND ar.name != ''
		 LIMIT 40`;

	const byId = new Map<string, SeedTrack>();

	// An explicit seed track (radio/queue) is the strongest signal.
	if (seedTrackId) {
		const seedRows = await prisma.$queryRaw<SeedTrack[]>`
			SELECT t.id as id, t.title as title, ar.name as artist
			 FROM tracks t JOIN artists ar ON ar.id = t.artist_id
			 WHERE t.id = ${seedTrackId} LIMIT 1`;
		const seed = seedRows[0];
		if (seed?.artist) byId.set(seed.id, seed);
	}

	for (const r of [...rows, ...libRows]) {
		if (!byId.has(r.id)) byId.set(r.id, r);
	}

	const tracks = [...byId.values()];
	const artists = dedupe(tracks.map((t) => t.artist)).slice(0, SEED_ARTIST_CAP);
	return { tracks, artists };
}

// ── Candidate gathering (Last.fm) ────────────────────────────────────────────────
type Candidate = { title: string; artist: string; score: number };

async function gatherLastfmCandidates(seeds: {
	tracks: SeedTrack[];
	artists: string[];
}): Promise<Candidate[]> {
	const scores = new Map<string, Candidate>();
	const seedKeys = new Set(
		seeds.tracks.map((t) => candidateKey(t.artist, t.title)),
	);

	const add = (artist: string, title: string, score: number) => {
		if (!artist || !title) return;
		const key = candidateKey(artist, title);
		if (seedKeys.has(key)) return; // never recommend a seed back
		const existing = scores.get(key);
		if (existing) existing.score += score;
		else scores.set(key, { title, artist, score });
	};

	// 1) Similar tracks for each seed track.
	const trackSeeds = seeds.tracks.slice(0, SEED_TRACK_CAP);
	await Promise.allSettled(
		trackSeeds.map(async (seed) => {
			const sims = await lastfmClient.getSimilarTracks(
				seed.artist,
				seed.title,
				SIMILAR_PER_TRACK,
			);
			for (const s of sims) {
				add(s.artist.name, s.name, (s.match ?? 0.3) + 0.1);
			}
		}),
	);

	// 2) Similar artists -> their top tracks.
	await Promise.allSettled(
		seeds.artists.map(async (artistName) => {
			const similar = await lastfmClient.getSimilarArtists(
				artistName,
				SIMILAR_ARTISTS,
			);
			await Promise.allSettled(
				similar.slice(0, SIMILAR_ARTISTS).map(async (sa) => {
					const top = await lastfmClient.getArtistTopTracks(
						sa.name,
						TOP_TRACKS_PER_ARTIST,
					);
					top.forEach((t, i) => {
						// rank-decayed contribution from a similar artist's top tracks
						add(t.artist.name, t.name, 0.3 * (1 - i / top.length) + 0.05);
					});
				}),
			);
		}),
	);

	return [...scores.values()].sort((a, b) => b.score - a.score);
}

// ── Resolve Last.fm candidates to playable Tidal tracks ──────────────────────────
async function resolveCandidates(
	ranked: Candidate[],
	limit: number,
	exclude: Set<string>,
): Promise<RecommendedTrack[]> {
	const out: RecommendedTrack[] = [];
	const perArtist = new Map<string, number>();
	const seenIds = new Set<string>(exclude);
	const maxScore = ranked[0]?.score || 1;

	const pool = ranked.slice(0, MAX_TIDAL_LOOKUPS);
	const batchSize = config.tidalResolveBatch;

	for (let i = 0; i < pool.length && out.length < limit; i += batchSize) {
		const batch = pool.slice(i, i + batchSize);
		const resolved = await Promise.allSettled(
			batch.map(async (c) => {
				const tidal = await searchTidalTrack(c.title, c.artist);
				return tidal ? { tidal, cand: c } : null;
			}),
		);

		for (const r of resolved) {
			if (out.length >= limit) break;
			if (r.status !== "fulfilled" || !r.value) continue;
			const { tidal, cand } = r.value;
			const id = String(tidal.id);
			if (seenIds.has(id)) continue;

			const artistId = tidal.artist?.id ? String(tidal.artist.id) : null;
			if (artistId) {
				const count = perArtist.get(artistId) ?? 0;
				if (count >= MAX_PER_ARTIST) continue;
				perArtist.set(artistId, count + 1);
			}

			seenIds.add(id);
			await upsertHifiTrack(tidal);
			out.push({
				trackId: id,
				title: tidal.title,
				artistName: tidal.artist?.name ?? tidal.artists?.[0]?.name ?? null,
				albumTitle: tidal.album?.title ?? null,
				coverUrl: tidal.album?.cover ?? null,
				score: +(cand.score / maxScore).toFixed(4),
				reason: "Based on your listening",
			});
		}
	}

	return out;
}

// ── Generic (new users / fallback) ───────────────────────────────────────────────
async function genericRecs(
	limit: number,
	excludeIds: string[],
): Promise<RecommendedTrack[]> {
	if (limit <= 0) return [];

	// Try Last.fm for real trending tracks first.
	const trendingTracks = await fetchTrendingTracksFallback(limit * 2);

	if (trendingTracks.length >= limit) {
		const excludeSet = new Set(excludeIds);
		const filtered = trendingTracks.filter(
			(t) => !excludeSet.has(String(t.id)),
		);

		return filtered.slice(0, limit).map((t) => ({
			trackId: String(t.id),
			title: t.title,
			artistName: t.artist?.name ?? t.artists?.[0]?.name ?? null,
			albumTitle: t.album?.title ?? null,
			coverUrl: t.album?.cover ?? null,
			score: (t as EnrichedTrack).lastFmPlayCount
				? (Math.log1p((t as EnrichedTrack).lastFmPlayCount!) /
						Math.log1p(1000000)) *
					100
				: (t.popularity ?? 0),
			reason: "Trending now",
		}));
	}

	// Fallback to database popularity if Last.fm fails.
	const rows = await prisma.track.findMany({
		where: excludeIds.length ? { id: { notIn: excludeIds } } : undefined,
		orderBy: { popularity: "desc" },
		take: limit,
		select: { id: true, title: true, popularity: true },
	});

	return rows.map((t) => ({
		trackId: t.id,
		title: t.title,
		artistName: null,
		albumTitle: null,
		coverUrl: null,
		score: t.popularity ?? 0,
		reason: "Popular right now",
	}));
}

// ── Helpers ──────────────────────────────────────────────────────────────────────
function candidateKey(artist: string, title: string): string {
	return `${artist}|${title}`.toLowerCase().trim();
}

function dedupe(values: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const v of values) {
		const key = (v ?? "").trim().toLowerCase();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push(v.trim());
	}
	return out;
}

async function recentlyPlayedIds(userId: string): Promise<Set<string>> {
	const cutoffSec = Math.floor(Date.now() / 1000) - 7 * 86400;
	const rows = await prisma.userInteraction.findMany({
		where: {
			userId,
			eventType: "play",
			occurredAt: { gte: cutoffSec },
			trackId: { not: null },
		},
		select: { trackId: true },
	});
	return new Set(rows.map((r) => r.trackId).filter((v): v is string => !!v));
}

/** Lower-cased names of artists the user skipped in the last 30 days. */
async function recentlySkippedArtistNames(
	userId: string,
): Promise<Set<string>> {
	try {
		const cutoffSec = Math.floor(Date.now() / 1000) - 30 * 86400;
		const rows = await prisma.$queryRaw<Array<{ name: string }>>`
			SELECT DISTINCT ar.name as name
			 FROM user_interactions ui
			 JOIN artists ar ON ar.id = ui.artist_id
			 WHERE ui.user_id = ${userId} AND ui.event_type = 'skip'
			   AND ui.occurred_at >= ${cutoffSec}`;
		return new Set(
			rows.map((r) => (r.name ?? "").trim().toLowerCase()).filter(Boolean),
		);
	} catch {
		return new Set();
	}
}

/** Track IDs shown >= 4 times in the last 14 days (over-exposed → suppress). */
async function overexposedTrackIds(userId: string): Promise<Set<string>> {
	try {
		const cutoffSec = Math.floor(Date.now() / 1000) - 14 * 86400;
		const rows = await prisma.$queryRaw<Array<{ item_id: string }>>`
			SELECT item_id
			 FROM shelf_impressions
			 WHERE user_id = ${userId} AND item_type IN ('track','mix')
			   AND shown_at >= ${cutoffSec}
			 GROUP BY item_id
			 HAVING COUNT(*) >= 4`;
		return new Set(rows.map((r) => String(r.item_id)));
	} catch {
		return new Set();
	}
}

// ── Radio Seeds ───────────────────────────────────────────────────────────────
export async function pickRadioSeeds(userId: string): Promise<string[]> {
	const [historyRows, libraryRows] = await Promise.all([
		prisma.userInteraction.findMany({
			where: { userId, eventType: "play", trackId: { not: null } },
			orderBy: { occurredAt: "desc" },
			take: 100,
			select: { trackId: true },
		}),
		prisma.userLibrary.findMany({
			where: { userId, itemType: "track" },
			take: 100,
			select: { itemId: true },
		}),
	]);

	const history = historyRows
		.map((r) => r.trackId)
		.filter((v): v is string => !!v);
	const library = libraryRows.map((r) => r.itemId).filter(Boolean);

	const combined = [...new Set([...history, ...library])];
	for (let i = combined.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[combined[i], combined[j]] = [combined[j], combined[i]];
	}

	return combined.slice(0, 50);
}

// ── Homepage Personalized Sections ───────────────────────────────────────────

export async function getMadeForYou(
	userId: string,
	limit = 10,
): Promise<RecommendedTrack[]> {
	const cacheKey = recCacheKey(userId, "made_for_you");
	const cached = recCache.get(cacheKey);
	if (cached) return cached as RecommendedTrack[];

	const tracks = await recommend({ userId, surface: "made_for_you", limit });
	recCache.set(cacheKey, tracks);
	return tracks;
}

export async function getFavouriteArtists(
	userId: string,
	limit = 8,
): Promise<RecommendedArtist[]> {
	const cacheKey = recCacheKey(userId, "favourite_artists");
	const cached = recCache.get(cacheKey);
	if (cached) return cached as unknown as RecommendedArtist[];

	// Get artists from user interactions (plays, likes, saves) and library
	const artistRows = await prisma.$queryRaw<
		Array<{
			id: string;
			name: string;
			picture_url: string | null;
			genres: string | null;
			play_count: number;
			score: number | null;
		}>
	>`
		SELECT
			a.id,
			a.name,
			a.picture_url,
			a.genres,
			COUNT(ui.id)::int as play_count,
			SUM(CASE WHEN ui.event_type IN ('like', 'save', 'follow') THEN 2
					 WHEN ui.event_type = 'play' THEN 1
					 WHEN ui.event_type = 'skip' THEN -0.5
					 ELSE 0 END)::float as score
		FROM artists a
		LEFT JOIN user_interactions ui ON a.id = ui.artist_id AND ui.user_id = ${userId}
		WHERE ui.user_id = ${userId} OR a.id IN (
			SELECT item_id FROM user_library WHERE user_id = ${userId} AND item_type = 'artist'
		)
		GROUP BY a.id
		ORDER BY score DESC, play_count DESC
		LIMIT ${limit}`;

	// If no user data, return popular artists from Last.fm
	let artists: RecommendedArtist[];
	if (artistRows.length === 0) {
		const popularArtists = await fetchPopularArtistsFallback(limit);

		if (popularArtists.length >= limit) {
			artists = popularArtists.slice(0, limit).map((a, i) => ({
				artistId: String(a.id),
				name: a.name ?? "Unknown Artist",
				pictureUrl: a.picture ?? null,
				genres: [],
				score: (popularArtists.length - i) / popularArtists.length,
			}));
		} else {
			// Fallback to database popularity
			const popularRows = await prisma.artist.findMany({
				orderBy: { popularity: "desc" },
				take: limit,
				select: { id: true, name: true, pictureUrl: true, genres: true },
			});
			artists = popularRows.map((a, i) => ({
				artistId: a.id,
				name: a.name,
				pictureUrl: a.pictureUrl ?? null,
				genres: a.genres ? fromJson<string[]>(a.genres, []) : [],
				score: (popularRows.length - i) / popularRows.length,
			}));
		}
	} else {
		artists = artistRows.map((a) => ({
			artistId: a.id,
			name: a.name,
			pictureUrl: a.picture_url ?? null,
			genres: a.genres ? fromJson<string[]>(a.genres, []) : [],
			score: Math.max(0, a.score ?? 0),
		}));
	}

	recCache.set(cacheKey, artists as unknown as RecommendedTrack[]);
	return artists;
}

/**
 * Albums by the user's favourite (and similar) artists, via Last.fm
 * artist.getTopAlbums resolved to playable Tidal albums. Returns [] when the
 * user has no seed artists or Last.fm/Tidal yields nothing (callers fall back).
 */
async function albumsFromSeedArtists(
	userId: string,
	limit: number,
): Promise<RecommendedAlbum[]> {
	const seeds = await getUserSeeds(userId);
	if (!seeds.artists.length) return [];

	const out: RecommendedAlbum[] = [];
	const seen = new Set<string>();

	for (const artistName of seeds.artists) {
		if (out.length >= limit) break;
		const topAlbums = await lastfmClient.getArtistTopAlbums(artistName, 6);
		for (const lfAlbum of topAlbums) {
			if (out.length >= limit) break;
			const tidal = await searchTidalAlbum(lfAlbum.name, artistName);
			if (!tidal) continue;
			const id = String(tidal.id);
			if (seen.has(id)) continue;
			seen.add(id);
			await upsertAlbumBasic(
				id,
				tidal.title,
				tidal.cover ?? null,
				toJson(tidal),
			);
			out.push({
				albumId: id,
				title: tidal.title,
				artistName: tidal.artist?.name ?? artistName,
				coverUrl: tidal.cover ?? null,
				releaseDate: tidal.releaseDate ?? null,
				score: (limit - out.length) / limit,
			});
		}
	}

	return out;
}

export async function getAlbumsForYou(
	userId: string,
	limit = 10,
): Promise<RecommendedAlbum[]> {
	const cacheKey = recCacheKey(userId, "albums_for_you");
	const cached = recCache.get(cacheKey);
	if (cached) return cached as unknown as RecommendedAlbum[];

	const profile = await getProfile(userId);

	// Get albums based on user's listening history and preferred genres
	let albums: RecommendedAlbum[];

	// Best source when we know the user: their favourite artists' top albums.
	const seedAlbums = await albumsFromSeedArtists(userId, limit).catch(() => []);
	if (seedAlbums.length >= Math.min(limit, 5)) {
		recCache.set(cacheKey, seedAlbums as unknown as RecommendedTrack[]);
		return seedAlbums;
	}

	type AlbumRow = {
		id: string;
		title: string;
		cover_url: string | null;
		release_date: string | null;
		artist_name: string | null;
		album_popularity: number | null;
	};

	if (
		profile?.preferredGenres &&
		Object.keys(profile.preferredGenres).length > 0
	) {
		// Get albums from preferred genres
		const topGenres = Object.entries(profile.preferredGenres)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([g]) => g);

		const albumRows = await prisma.$queryRaw<AlbumRow[]>`
			SELECT
				al.id,
				al.title,
				al.cover_url,
				al.release_date,
				MAX(ar.name) as artist_name,
				MAX(t.popularity) as album_popularity
			FROM albums al
			JOIN tracks t ON t.album_id = al.id
			JOIN track_features tf ON tf.track_id = t.id
			JOIN artists ar ON ar.id = t.artist_id
			WHERE tf.genre IN (${Prisma.join(topGenres)})
			GROUP BY al.id
			ORDER BY album_popularity DESC, al.release_date DESC
			LIMIT ${limit}`;

		albums = albumRows.map((a, i) => ({
			albumId: a.id,
			title: a.title,
			artistName: a.artist_name ?? null,
			coverUrl: a.cover_url ?? null,
			releaseDate: a.release_date ?? null,
			score: (albumRows.length - i) / albumRows.length,
		}));
	} else {
		// Fallback to popular albums (using track popularity as proxy)
		const albumRows = await prisma.$queryRaw<AlbumRow[]>`
			SELECT
				al.id,
				al.title,
				al.cover_url,
				al.release_date,
				MAX(ar.name) as artist_name,
				MAX(t.popularity) as album_popularity
			FROM albums al
			JOIN tracks t ON t.album_id = al.id
			LEFT JOIN artists ar ON ar.id = t.artist_id
			GROUP BY al.id
			ORDER BY album_popularity DESC, al.release_date DESC
			LIMIT ${limit}`;

		albums = albumRows.map((a, i) => ({
			albumId: a.id,
			title: a.title,
			artistName: a.artist_name ?? null,
			coverUrl: a.cover_url ?? null,
			releaseDate: a.release_date ?? null,
			score: (albumRows.length - i) / albumRows.length,
		}));
	}

	recCache.set(cacheKey, albums as unknown as RecommendedTrack[]);
	return albums;
}

export async function getTopMixes(
	userId: string,
	limit = 6,
): Promise<RecommendedMix[]> {
	const cacheKey = recCacheKey(userId, "top_mixes");
	const cached = recCache.get(cacheKey);
	if (cached) return cached as unknown as RecommendedMix[];

	// Get mix IDs from user's listening history
	const mixRows = await prisma.$queryRaw<
		Array<{ mix_ids: string | null; play_count: number; last_played: number }>
	>`
		SELECT
			t.mix_ids,
			COUNT(ui.id)::int as play_count,
			MAX(ui.occurred_at) as last_played
		FROM user_interactions ui
		JOIN tracks t ON t.id = ui.track_id
		WHERE ui.user_id = ${userId} AND ui.event_type = 'play' AND t.mix_ids IS NOT NULL
		GROUP BY t.mix_ids
		ORDER BY play_count DESC, last_played DESC
		LIMIT 20`;

	// Parse mix_ids JSON and aggregate
	const mixScores = new Map<string, number>();
	for (const row of mixRows) {
		if (!row.mix_ids) continue;
		const mixIds = fromJson<string[]>(row.mix_ids, []);
		for (const mixId of mixIds) {
			mixScores.set(mixId, (mixScores.get(mixId) ?? 0) + (row.play_count ?? 1));
		}
	}

	// Convert to sorted array and take top
	const sortedMixes = [...mixScores.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit);

	// Build mix objects (mixes don't have a separate table, so we construct from listening data)
	const mixes: RecommendedMix[] = sortedMixes.map(([mixId, score]) => ({
		mixId,
		title: `Mix ${mixId.replace(/-/g, " ").replace(/_/g, " ")}`,
		subTitle: "Based on your listening",
		coverUrl: null,
		score: score / (sortedMixes[0]?.[1] ?? 1),
	}));

	// If no mixes from history, return empty (mixes need to come from actual listening)
	recCache.set(cacheKey, mixes as unknown as RecommendedTrack[]);
	return mixes;
}
