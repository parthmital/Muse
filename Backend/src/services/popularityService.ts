/**
 * src/services/popularityService.ts
 *
 * Fetches real popularity/trending data from Last.fm and maps it to Tidal content.
 * This replaces keyword-based searches with actual chart data.
 */

import { lastfmClient, LastFMAlbum } from "./lastfmClient.js";
import { hifiClient, HifiTrack, HifiArtist, HifiAlbum } from "./hifiClient.js";
import {
	titleSimilarity,
	nameSimilarity,
	pickBest,
	THRESHOLDS,
	type ScoredCandidate,
} from "./matching.js";
import { resolveCached } from "./serviceMapping.js";
import { config } from "../config.js";
import { prisma } from "../db/prisma.js";
import { logger } from "../logger.js";

const log = logger.child({ scope: "popularity" });

// Log configuration status on module load
if (!config.lastfmApiKey) {
	log.warn(
		"LASTFM_API_KEY not configured — using local database fallbacks for trending/popular content. Get a key at https://www.last.fm/api/account/create",
	);
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface EnrichedTrack extends HifiTrack {
	lastFmPlayCount?: number;
	lastFmListeners?: number;
	lastFmRank?: number;
}

export interface EnrichedArtist extends HifiArtist {
	lastFmPlayCount?: number;
	lastFmListeners?: number;
	lastFmRank?: number;
}

export interface EnrichedAlbum extends HifiAlbum {
	lastFmPlayCount?: number;
	lastFmRank?: number;
}

// ── Resolution helpers ─────────────────────────────────────────────────────
//
// Last.fm entities (name + artist) are resolved to Tidal via a text search +
// fuzzy scoring (matching.ts), wrapped in a persistent cache (serviceMapping.ts)
// that also remembers *negative* results so unmatched entries aren't re-searched
// forever. The relevance gate is shared across all three entity types: nothing
// that clears the threshold → null, never items[0]. A bad query (or an entity
// missing from Tidal) must NOT silently resolve to an unrelated result — that's
// how off-theme tracks leak into mixes. A short, correct mix beats a wrong one.

function tidalArtistName(e: {
	artist?: { name?: string };
	artists?: Array<{ name?: string }>;
}): string {
	return e.artist?.name ?? e.artists?.[0]?.name ?? "";
}

// ── Track Methods ────────────────────────────────────────────────────────────

export async function searchTidalTrack(
	title: string,
	artist: string,
): Promise<HifiTrack | null> {
	return resolveCached<HifiTrack>("track", [artist, title], async () => {
		try {
			const result = await hifiClient.searchTracks(`${artist} ${title}`, 10, 0);
			const scored: Array<ScoredCandidate<HifiTrack>> = result.items.map(
				(t) => ({
					item: t,
					score:
						titleSimilarity(title, t.title) * 0.6 +
						nameSimilarity(artist, tidalArtistName(t)) * 0.4,
					popularity: t.popularity ?? 0,
				}),
			);
			const best = pickBest(scored, THRESHOLDS.track);
			if (!best) return { item: null, confidence: 0 };
			return {
				item: best.item,
				confidence: best.score,
				method: best.score >= 0.999 ? "exact" : "fuzzy",
				isrc: best.item.isrc ?? null,
			};
		} catch {
			return { item: null, confidence: 0 };
		}
	});
}

export async function fetchTrendingTracks(
	limit = 50,
	period: "7day" | "1month" | "3month" = "7day",
): Promise<EnrichedTrack[]> {
	const lastFmTracks = await lastfmClient.getTopTracks(period, limit * 2);
	if (!lastFmTracks.length) return [];

	const enriched: EnrichedTrack[] = [];

	// Process in batches to avoid overwhelming Tidal API
	const batchSize = config.tidalResolveBatch;
	for (
		let i = 0;
		i < lastFmTracks.length && enriched.length < limit;
		i += batchSize
	) {
		const batch = lastFmTracks.slice(i, i + batchSize);

		const batchResults = await Promise.allSettled(
			batch.map(async (lfTrack, index) => {
				const tidalTrack = await searchTidalTrack(
					lfTrack.name,
					lfTrack.artist.name,
				);

				if (!tidalTrack) return null;

				return {
					...tidalTrack,
					lastFmPlayCount: lfTrack.playcount
						? parseInt(lfTrack.playcount, 10)
						: undefined,
					lastFmListeners: lfTrack.listeners
						? parseInt(lfTrack.listeners, 10)
						: undefined,
					lastFmRank: i + index + 1,
				} as EnrichedTrack;
			}),
		);

		for (const result of batchResults) {
			if (result.status === "fulfilled" && result.value) {
				enriched.push(result.value);
			}
		}

		// Small delay between batches
		if (i + batchSize < lastFmTracks.length) {
			await new Promise((r) => setTimeout(r, 100));
		}
	}

	return enriched.slice(0, limit);
}

export async function fetchPopularTracksByTag(
	tag: string,
	limit = 30,
): Promise<EnrichedTrack[]> {
	const lastFmTracks = await lastfmClient.getTopTracksByTag(tag, limit * 2);
	if (!lastFmTracks.length) return [];

	const enriched: EnrichedTrack[] = [];

	for (const lfTrack of lastFmTracks.slice(0, limit)) {
		const tidalTrack = await searchTidalTrack(
			lfTrack.name,
			lfTrack.artist.name,
		);

		if (tidalTrack) {
			enriched.push({
				...tidalTrack,
				lastFmPlayCount: lfTrack.playcount
					? parseInt(lfTrack.playcount, 10)
					: undefined,
				lastFmListeners: lfTrack.listeners
					? parseInt(lfTrack.listeners, 10)
					: undefined,
			});
		}
	}

	return enriched.slice(0, limit);
}

// ── Artist Methods ───────────────────────────────────────────────────────────

export async function searchTidalArtist(
	name: string,
): Promise<HifiArtist | null> {
	return resolveCached<HifiArtist>("artist", [name], async () => {
		try {
			const result = await hifiClient.searchArtists(name, 10, 0);
			const artists = result.artists?.items ?? [];
			const scored: Array<ScoredCandidate<HifiArtist>> = artists.map((a) => ({
				item: a,
				score: nameSimilarity(name, a.name),
				popularity: a.popularity ?? 0,
			}));
			const best = pickBest(scored, THRESHOLDS.artist);
			if (!best) return { item: null, confidence: 0 };
			return {
				item: best.item,
				confidence: best.score,
				method: best.score >= 0.999 ? "exact" : "fuzzy",
			};
		} catch {
			return { item: null, confidence: 0 };
		}
	});
}

export async function fetchPopularArtists(
	limit = 50,
	period: "7day" | "1month" | "3month" = "7day",
): Promise<EnrichedArtist[]> {
	const lastFmArtists = await lastfmClient.getTopArtists(period, limit * 2);
	if (!lastFmArtists.length) return [];

	const enriched: EnrichedArtist[] = [];

	for (const lfArtist of lastFmArtists.slice(0, limit)) {
		const tidalArtist = await searchTidalArtist(lfArtist.name);

		if (tidalArtist) {
			enriched.push({
				...tidalArtist,
				lastFmPlayCount: lfArtist.playcount
					? parseInt(lfArtist.playcount, 10)
					: undefined,
				lastFmListeners: lfArtist.listeners
					? parseInt(lfArtist.listeners, 10)
					: undefined,
				lastFmRank: enriched.length + 1,
			});
		}
	}

	return enriched;
}

export async function fetchPopularArtistsByTag(
	tag: string,
	limit = 30,
): Promise<EnrichedArtist[]> {
	const lastFmArtists = await lastfmClient.getTopArtistsByTag(tag, limit * 2);
	if (!lastFmArtists.length) return [];

	const enriched: EnrichedArtist[] = [];

	for (const lfArtist of lastFmArtists.slice(0, limit)) {
		const tidalArtist = await searchTidalArtist(lfArtist.name);

		if (tidalArtist) {
			enriched.push({
				...tidalArtist,
				lastFmPlayCount: lfArtist.playcount
					? parseInt(lfArtist.playcount, 10)
					: undefined,
				lastFmListeners: lfArtist.listeners
					? parseInt(lfArtist.listeners, 10)
					: undefined,
			});
		}
	}

	return enriched.slice(0, limit);
}

// ── Album Methods ────────────────────────────────────────────────────────────

export async function searchTidalAlbum(
	title: string,
	artist: string,
): Promise<HifiAlbum | null> {
	return resolveCached<HifiAlbum>("album", [artist, title], async () => {
		try {
			const result = await hifiClient.searchAlbums(`${artist} ${title}`, 10, 0);
			const scored: Array<ScoredCandidate<HifiAlbum>> = result.items.map(
				(a) => ({
					item: a,
					score:
						titleSimilarity(title, a.title) * 0.6 +
						nameSimilarity(artist, tidalArtistName(a)) * 0.4,
					popularity: (a as { popularity?: number }).popularity ?? 0,
				}),
			);
			const best = pickBest(scored, THRESHOLDS.album);
			if (!best) return { item: null, confidence: 0 };
			return {
				item: best.item,
				confidence: best.score,
				method: best.score >= 0.999 ? "exact" : "fuzzy",
			};
		} catch {
			return { item: null, confidence: 0 };
		}
	});
}

// Resolve a prioritized list of Last.fm album candidates to real Tidal albums,
// stopping once `limit` unique albums are found. Over-fetch candidates upstream
// so the relevance gate (searchTidalAlbum → null) and duplicates don't leave the
// grid short of the requested count.
async function resolveAlbumCandidates(
	candidates: LastFMAlbum[],
	limit: number,
): Promise<EnrichedAlbum[]> {
	const enriched: EnrichedAlbum[] = [];
	const seenId = new Set<string>();
	const batchSize = config.tidalResolveBatch;

	for (
		let i = 0;
		i < candidates.length && enriched.length < limit;
		i += batchSize
	) {
		const batch = candidates.slice(i, i + batchSize);

		const results = await Promise.allSettled(
			batch.map(async (lfAlbum) => {
				const tidalAlbum = await searchTidalAlbum(
					lfAlbum.name,
					lfAlbum.artist.name,
				);
				if (!tidalAlbum) return null;
				return {
					...tidalAlbum,
					lastFmPlayCount: lfAlbum.playcount
						? parseInt(lfAlbum.playcount, 10)
						: undefined,
				} as EnrichedAlbum;
			}),
		);

		for (const result of results) {
			if (result.status !== "fulfilled" || !result.value) continue;
			// Different Last.fm entries can map to the same Tidal album — dedupe so
			// the grid shows `limit` *distinct* albums.
			const id = String(result.value.id);
			if (seenId.has(id)) continue;
			seenId.add(id);
			result.value.lastFmRank = enriched.length + 1;
			enriched.push(result.value);
			if (enriched.length >= limit) break;
		}

		// Small delay between batches to avoid overwhelming the Tidal API.
		if (i + batchSize < candidates.length && enriched.length < limit) {
			await new Promise((r) => setTimeout(r, 100));
		}
	}

	return enriched.slice(0, limit);
}

export async function fetchPopularAlbums(
	limit = 50,
	_period: "7day" | "1month" | "3month" = "7day",
): Promise<EnrichedAlbum[]> {
	const topTags = await lastfmClient.getTopTags(10);
	if (!topTags.length) return [];

	// "All" must be genuine cross-genre popularity — NOT the single most popular
	// tag's album list (which made the All tab identical to the Rock tab, since
	// "rock" is Last.fm's #1 top tag). Pull each top genre's albums and round-
	// robin interleave them so the blend draws evenly across genres.
	const tags = topTags.slice(0, 6);
	const perTag = Math.max(limit, 20);
	const lists = await Promise.all(
		tags.map((t) =>
			lastfmClient.getTopAlbumsByTag(t.name, perTag).catch(() => []),
		),
	);

	const candidates: LastFMAlbum[] = [];
	const seen = new Set<string>();
	const maxLen = lists.reduce((m, l) => Math.max(m, l.length), 0);
	for (let col = 0; col < maxLen; col++) {
		for (const list of lists) {
			const lfAlbum = list[col];
			if (!lfAlbum) continue;
			const key = `${lfAlbum.name}|${lfAlbum.artist.name}`.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			candidates.push(lfAlbum);
		}
	}

	return resolveAlbumCandidates(candidates, limit);
}

export async function fetchAlbumsByTag(
	tag: string,
	limit = 50,
): Promise<EnrichedAlbum[]> {
	// Over-fetch (3×) so the relevance gate and duplicates don't leave us short
	// of `limit` resolved albums.
	const lastFmAlbums = await lastfmClient.getTopAlbumsByTag(tag, limit * 3);
	if (!lastFmAlbums.length) return [];

	const candidates: LastFMAlbum[] = [];
	const seen = new Set<string>();
	for (const lfAlbum of lastFmAlbums) {
		const key = `${lfAlbum.name}|${lfAlbum.artist.name}`.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		candidates.push(lfAlbum);
	}

	return resolveAlbumCandidates(candidates, limit);
}

// ── Artist Top Tracks ────────────────────────────────────────────────────────

export async function fetchArtistTopTracks(
	artistName: string,
	limit = 20,
): Promise<EnrichedTrack[]> {
	const lastFmTracks = await lastfmClient.getArtistTopTracks(
		artistName,
		limit * 2,
	);
	if (!lastFmTracks.length) return [];

	const enriched: EnrichedTrack[] = [];

	for (const lfTrack of lastFmTracks.slice(0, limit)) {
		const tidalTrack = await searchTidalTrack(
			lfTrack.name,
			lfTrack.artist.name,
		);

		if (tidalTrack) {
			enriched.push({
				...tidalTrack,
				lastFmPlayCount: lfTrack.playcount
					? parseInt(lfTrack.playcount, 10)
					: undefined,
				lastFmListeners: lfTrack.listeners
					? parseInt(lfTrack.listeners, 10)
					: undefined,
			});
		}
	}

	return enriched.slice(0, limit);
}

// ── Fallback Methods ─────────────────────────────────────────────────────────

export async function fetchTrendingTracksFallback(
	minCount: number,
): Promise<HifiTrack[]> {
	// Primary: Last.fm weekly chart.
	const tracks = await fetchTrendingTracks(minCount);
	if (tracks.length >= minCount) {
		log.debug({ found: tracks.length }, "Using Last.fm trending tracks");
		return tracks;
	}

	// Top up from other *real* chart sources — never a blind keyword search.
	// `searchTracks("viral")` returns songs merely titled "viral"/"popular",
	// which then get persisted into the catalog and pollute every downstream
	// pool and mix. More chart periods + top-tag charts are real popularity.
	const collected: HifiTrack[] = [...tracks];
	const seen = new Set(collected.map((t) => String(t.id)));
	const addAll = (more: HifiTrack[]) => {
		for (const t of more) {
			const id = String(t.id);
			if (seen.has(id)) continue;
			seen.add(id);
			collected.push(t);
		}
	};

	for (const period of ["1month", "3month"] as const) {
		if (collected.length >= minCount) break;
		try {
			addAll(await fetchTrendingTracks(minCount, period));
		} catch {
			// Try the next source.
		}
	}

	if (collected.length < minCount) {
		try {
			const tags = await lastfmClient.getTopTags(5);
			for (const tag of tags) {
				if (collected.length >= minCount) break;
				addAll(await fetchPopularTracksByTag(tag.name, minCount));
			}
		} catch {
			// Fall through with whatever real data we collected.
		}
	}

	if (collected.length < minCount) {
		log.warn(
			{ found: collected.length, want: minCount },
			"Last.fm chart data insufficient; returning real results only (no keyword fallback)",
		);
	}

	return collected;
}

export async function fetchPopularArtistsFallback(
	minCount: number,
): Promise<HifiArtist[]> {
	// Try Last.fm first
	const artists = await fetchPopularArtists(minCount);
	if (artists.length >= minCount) {
		log.debug({ found: artists.length }, "Using Last.fm popular artists");
		return artists;
	}

	// Fallback to local database artists ordered by popularity
	log.warn(
		{ found: artists.length, want: minCount },
		"Last.fm artists insufficient, falling back to local database",
	);

	try {
		const rows = await prisma.artist.findMany({
			orderBy: [{ popularity: "desc" }, { updatedAt: "desc" }],
			take: minCount,
			select: { id: true, name: true, pictureUrl: true, popularity: true },
		});
		if (rows.length > 0) {
			log.debug({ found: rows.length }, "Using local database artists");
			return rows.map((row) => ({
				id: row.id,
				name: row.name,
				picture: row.pictureUrl,
				popularity: row.popularity,
			})) as HifiArtist[];
		}
		return [];
	} catch {
		return [];
	}
}

export async function fetchPopularAlbumsFallback(
	minCount: number,
): Promise<HifiAlbum[]> {
	// Try Last.fm first
	const albums = await fetchPopularAlbums(minCount);
	if (albums.length >= minCount) {
		log.debug({ found: albums.length }, "Using Last.fm popular albums");
		return albums;
	}

	// Fallback to local database albums ordered by popularity
	log.warn(
		{ found: albums.length, want: minCount },
		"Last.fm albums insufficient, falling back to local database",
	);

	try {
		const rows = await prisma.$queryRaw<
			Array<{
				id: string;
				title: string;
				cover_url: string | null;
				max_popularity: number | null;
			}>
		>`
			SELECT al.id, al.title, al.cover_url, MAX(t.popularity) as max_popularity
			FROM albums al
			JOIN tracks t ON t.album_id = al.id
			GROUP BY al.id
			ORDER BY max_popularity DESC, al.updated_at DESC
			LIMIT ${minCount}`;

		if (rows.length > 0) {
			log.debug({ found: rows.length }, "Using local database albums");
			return rows.map((row) => ({
				id: row.id,
				title: row.title,
				cover: row.cover_url,
				popularity: row.max_popularity,
			})) as HifiAlbum[];
		}
		return [];
	} catch {
		return [];
	}
}
