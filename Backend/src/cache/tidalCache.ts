/**
 * src/cache/tidalCache.ts
 *
 * LRU caches for Tidal-API proxy responses.
 * Mirrors Monochrome's APICache pattern but server-side.
 */

import { LRUCache } from "lru-cache";

const THIRTY_MINUTES = 1000 * 60 * 30;
const ONE_HOUR = 1000 * 60 * 60;
const FIVE_MINUTES = 1000 * 60 * 5;

/** Search results cache – moderate TTL, keyed by "type:query:offset:limit" */
export const searchCache = new LRUCache<string, any>({
	max: 500,
	ttl: THIRTY_MINUTES,
	allowStale: false,
});

/** Album data cache – longer TTL since album data rarely changes */
export const albumCache = new LRUCache<string, any>({
	max: 200,
	ttl: ONE_HOUR,
	allowStale: true,
});

/** Artist data cache */
export const artistCache = new LRUCache<string, any>({
	max: 200,
	ttl: ONE_HOUR,
	allowStale: true,
});

/** Playlist data cache */
export const playlistCache = new LRUCache<string, any>({
	max: 100,
	ttl: THIRTY_MINUTES,
	allowStale: true,
});

/** Mix data cache */
export const mixCache = new LRUCache<string, any>({
	max: 100,
	ttl: THIRTY_MINUTES,
	allowStale: true,
});

/** Track info cache */
export const trackInfoCache = new LRUCache<string, any>({
	max: 1000,
	ttl: ONE_HOUR,
	allowStale: true,
});

/** Recommendations cache – shorter TTL for freshness */
export const tidalRecCache = new LRUCache<string, any>({
	max: 200,
	ttl: FIVE_MINUTES,
	allowStale: true,
});

/** Stream info cache – short TTL since stream URLs expire */
export const streamCache = new LRUCache<string, any>({
	max: 100,
	ttl: FIVE_MINUTES,
	allowStale: false,
});

// ── Cache key helpers ────────────────────────────────────────────────────────

export function searchKey(
	type: string,
	query: string,
	limit: number,
	offset: number,
): string {
	return `${type}:${query}:${offset}:${limit}`;
}

export function clearAllTidalCaches(): void {
	searchCache.clear();
	albumCache.clear();
	artistCache.clear();
	playlistCache.clear();
	mixCache.clear();
	trackInfoCache.clear();
	tidalRecCache.clear();
	streamCache.clear();
}
