/**
 * src/services/popularityService.ts
 *
 * Fetches real popularity/trending data from Last.fm and maps it to Tidal content.
 * This replaces keyword-based searches with actual chart data.
 */

import {
	lastfmClient,
	LastFMTrack,
	LastFMArtist,
	LastFMAlbum,
} from "./lastfmClient.js";
import { hifiClient, HifiTrack, HifiArtist, HifiAlbum } from "./hifiClient.js";
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeText(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function similarityScore(a: string, b: string): number {
	const normA = normalizeText(a);
	const normB = normalizeText(b);

	if (normA === normB) return 1;
	if (normA.includes(normB) || normB.includes(normA)) return 0.8;

	const wordsA = new Set(normA.split(" "));
	const wordsB = new Set(normB.split(" "));
	const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
	const union = new Set([...wordsA, ...wordsB]);

	return intersection.size / union.size;
}

function findBestMatch<T extends { title?: string; name?: string }>(
	query: string,
	items: T[],
	threshold = 0.6,
): T | null {
	let bestMatch: T | null = null;
	let bestScore = 0;

	for (const item of items) {
		const itemText = item.title ?? item.name ?? "";
		const score = similarityScore(query, itemText);
		if (score > bestScore && score >= threshold) {
			bestScore = score;
			bestMatch = item;
		}
	}

	return bestMatch;
}

// ── Track Methods ────────────────────────────────────────────────────────────

export async function searchTidalTrack(
	title: string,
	artist: string,
): Promise<HifiTrack | null> {
	try {
		// Search by "artist - title" for best results
		const query = `${artist} ${title}`;
		const result = await hifiClient.searchTracks(query, 10, 0);

		if (!result.items.length) return null;

		// Find best match by comparing both title and artist
		let bestMatch: HifiTrack | null = null;
		let bestScore = 0;

		for (const track of result.items) {
			const titleScore = similarityScore(title, track.title);
			const artistScore = similarityScore(
				artist,
				track.artist?.name ?? track.artists?.[0]?.name ?? "",
			);
			const combinedScore = titleScore * 0.6 + artistScore * 0.4;

			if (combinedScore > bestScore && combinedScore >= 0.5) {
				bestScore = combinedScore;
				bestMatch = track;
			}
		}

		// Return null when nothing clears the relevance threshold rather than
		// falling back to result.items[0]. A bad query (or a track missing from
		// Tidal) must NOT silently resolve to an unrelated song — that's how
		// off-theme tracks leak into mixes. A short, correct mix beats a wrong one.
		return bestMatch;
	} catch {
		return null;
	}
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
	try {
		const result = await hifiClient.searchArtists(name, 10, 0);
		const artists = result.artists?.items ?? [];

		if (!artists.length) return null;

		// Find best match by name similarity. Relevance gate (see
		// searchTidalTrack): no match → null, never artists[0]. Falling back to
		// the first result resolves a known Last.fm name to an unrelated artist.
		const match = findBestMatch(name, artists);
		return match;
	} catch {
		return null;
	}
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
	try {
		const query = `${artist} ${title}`;
		const result = await hifiClient.searchAlbums(query, 10, 0);

		if (!result.items.length) return null;

		// Find best match
		let bestMatch: HifiAlbum | null = null;
		let bestScore = 0;

		for (const album of result.items) {
			const titleScore = similarityScore(title, album.title);
			const artistScore = similarityScore(
				artist,
				album.artist?.name ?? album.artists?.[0]?.name ?? "",
			);
			const combinedScore = titleScore * 0.6 + artistScore * 0.4;

			if (combinedScore > bestScore && combinedScore >= 0.5) {
				bestScore = combinedScore;
				bestMatch = album;
			}
		}

		// Relevance gate (see searchTidalTrack): no match → null, never items[0].
		return bestMatch;
	} catch {
		return null;
	}
}

export async function fetchPopularAlbums(
	limit = 50,
	period: "7day" | "1month" | "3month" = "7day",
): Promise<EnrichedAlbum[]> {
	// Get top tags first
	const topTags = await lastfmClient.getTopTags(10);
	if (!topTags.length) return [];

	const enriched: EnrichedAlbum[] = [];
	const seenAlbums = new Set<string>();

	// Fetch top albums from each popular tag
	for (const tag of topTags.slice(0, 5)) {
		if (enriched.length >= limit) break;

		const lastFmAlbums = await lastfmClient.getTopAlbumsByTag(tag.name, 20);

		for (const lfAlbum of lastFmAlbums) {
			if (enriched.length >= limit) break;

			// Skip duplicates
			const key = `${lfAlbum.name}|${lfAlbum.artist.name}`.toLowerCase();
			if (seenAlbums.has(key)) continue;
			seenAlbums.add(key);

			const tidalAlbum = await searchTidalAlbum(
				lfAlbum.name,
				lfAlbum.artist.name,
			);

			if (tidalAlbum) {
				enriched.push({
					...tidalAlbum,
					lastFmPlayCount: lfAlbum.playcount
						? parseInt(lfAlbum.playcount, 10)
						: undefined,
					lastFmRank: enriched.length + 1,
				});
			}
		}
	}

	return enriched.slice(0, limit);
}

export async function fetchAlbumsByTag(
	tag: string,
	limit = 30,
): Promise<EnrichedAlbum[]> {
	const lastFmAlbums = await lastfmClient.getTopAlbumsByTag(tag, limit * 2);
	if (!lastFmAlbums.length) return [];

	const enriched: EnrichedAlbum[] = [];

	for (const lfAlbum of lastFmAlbums.slice(0, limit)) {
		const tidalAlbum = await searchTidalAlbum(
			lfAlbum.name,
			lfAlbum.artist.name,
		);

		if (tidalAlbum) {
			enriched.push({
				...tidalAlbum,
				lastFmPlayCount: lfAlbum.playcount
					? parseInt(lfAlbum.playcount, 10)
					: undefined,
			});
		}
	}

	return enriched.slice(0, limit);
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
