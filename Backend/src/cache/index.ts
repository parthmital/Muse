/**
 * src/cache/index.ts
 * In-memory LRU caches with TTL.
 * Avoids repeated database reads for hot data.
 *
 * Caches:
 *   profileCache   – user genre-preference profiles (5m TTL)
 *   recCache       – recommendation result lists (2m TTL)
 *   sessionCache   – playback queue state (3h TTL)
 */

import { LRUCache } from "lru-cache";
import { config } from "../config.js";

// ── User profile ──────────────────────────────────────────────────────────────
export type CachedProfile = {
	userId: string;
	preferredGenres: Record<string, number>;
	totalPlayCount: number;
};

export const profileCache = new LRUCache<string, CachedProfile>({
	max: 10_000,
	ttl: config.cacheProfileTtlMs,
	allowStale: false,
});

// ── Recommendation results ────────────────────────────────────────────────────
export type RecommendedTrack = {
	trackId: string;
	title: string;
	artistName: string | null;
	albumTitle: string | null;
	coverUrl: string | null;
	score: number;
	reason?: string;
};

export type RecommendedArtist = {
	artistId: string;
	name: string;
	pictureUrl: string | null;
	genres?: string[];
	score: number;
};

export type RecommendedAlbum = {
	albumId: string;
	title: string;
	artistName: string | null;
	coverUrl: string | null;
	releaseDate?: string | null;
	score: number;
};

export type RecommendedMix = {
	mixId: string;
	title: string;
	subTitle?: string;
	coverUrl: string | null;
	score: number;
};

export const recCache = new LRUCache<string, RecommendedTrack[]>({
	max: 50_000,
	ttl: config.cacheRecTtlMs,
	allowStale: true, // serve stale while rebuilding
});

// ── Session queue (in-memory, 3h TTL) ─────────────────────────────────────────
export type SessionQueueData = {
	tracks: RecommendedTrack[];
	playedIds: string[];
};

export const sessionCache = new LRUCache<string, SessionQueueData>({
	max: 100_000,
	ttl: config.sessionTtlMs,
	allowStale: false,
});

// ── Cache invalidation helpers ────────────────────────────────────────────────
export function invalidateProfile(userId: string) {
	profileCache.delete(userId);
	// Also invalidate recommendation caches for this user
	for (const key of recCache.keys()) {
		if (key.startsWith(`${userId}:`)) recCache.delete(key);
	}
}

export function recCacheKey(userId: string, surface: string) {
	return `${userId}:${surface}`;
}
