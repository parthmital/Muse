/**
 * src/cache/index.ts
 * In-memory LRU caches with TTL.
 * Avoids repeated SQLite reads for hot data.
 *
 * Caches:
 *   trackCache     – track + feature rows (1h TTL, 5000 items)
 *   profileCache   – user profile vectors (5m TTL)
 *   recCache       – recommendation result lists (2m TTL)
 *   featureCache   – track feature rows only (1h TTL)
 */

import { LRUCache } from "lru-cache";
import { config } from "../config.js";

// ── Track (with features joined) ──────────────────────────────────────────────
export type CachedTrack = {
	id: string;
	title: string;
	duration: number | null;
	bpm: number | null;
	popularity: number | null;
	explicit: boolean;
	isrc: string | null;
	artistId: string | null;
	albumId: string | null;
	artistName?: string;
	albumTitle?: string;
	coverUrl?: string;
};

export const trackCache = new LRUCache<string, CachedTrack>({
	max: config.cacheMaxItems,
	ttl: config.cacheTrackTtlMs,
	allowStale: false,
});

// ── Track features ────────────────────────────────────────────────────────────
export type CachedFeatures = {
	trackId: string;
	energy: number | null;
	valence: number | null;
	danceability: number | null;
	acousticness: number | null;
	instrumentalness: number | null;
	loudness: number | null;
	liveness: number | null;
	spotifyTempo: number | null;
	genre: string | null;
	moodTags: string[];
	embedding: number[] | null;
	enrichmentStatus: string;
};

export const featureCache = new LRUCache<string, CachedFeatures>({
	max: config.cacheMaxItems,
	ttl: config.cacheTrackTtlMs,
	allowStale: false,
});

// ── User profile ──────────────────────────────────────────────────────────────
export type CachedProfile = {
	userId: string;
	profileVector: number[] | null;
	avgEnergy: number | null;
	avgValence: number | null;
	avgDanceability: number | null;
	avgAcousticness: number | null;
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
	ttl: 3 * 60 * 60 * 1000,
	allowStale: false,
});

// ── Cache invalidation helpers ────────────────────────────────────────────────
export function invalidateTrack(trackId: string) {
	trackCache.delete(trackId);
	featureCache.delete(trackId);
}

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
