/**
 * src/services/serviceMapping.ts
 *
 * Persistent Last.fm → Tidal resolution cache (the `service_mappings` table).
 *
 * Last.fm and Tidal share no identifier, so resolving an entity means a text
 * search + fuzzy scoring (see matching.ts). That is the expensive part. This
 * layer remembers each outcome — including *negative* ones — so:
 *   - a track that appears in five Last.fm charts is resolved once, not five times;
 *   - the ~30-40% of Last.fm entries that simply aren't on Tidal stop being
 *     re-searched on every homepage/mix rebuild;
 *   - manual corrections (method = "manual") can be made permanent.
 *
 * All DB access is best-effort and wrapped: if the table/client is unavailable
 * (e.g. a hermetic unit test that mocks `prisma` as {}), reads report a miss and
 * writes are swallowed, so resolution degrades to "search every time" rather
 * than throwing.
 */

import { prisma } from "../db/prisma.js";
import { incr } from "../metrics.js";
import { keyFragment } from "./matching.js";

export type EntityType = "track" | "artist" | "album";

const DAY = 86_400;
// A confirmed match is stable identity — keep it long. A confirmed *no-match*
// is re-checked sooner, since Tidal's catalog grows and the track may appear.
const POSITIVE_TTL = 30 * DAY;
const NEGATIVE_TTL = 7 * DAY;

/** Build the normalized lookup key for a Last.fm entity. */
export function mappingKey(entityType: EntityType, parts: string[]): string {
	return parts.map((p) => keyFragment(p)).join("|");
}

/**
 * Tri-state read:
 *   - returns the parsed Tidal entity   → fresh positive hit (zero network);
 *   - returns null                       → fresh *negative* hit (skip searching);
 *   - returns undefined                  → miss/stale/unavailable (caller searches).
 */
export async function readMapping<T>(
	entityType: EntityType,
	lfKey: string,
): Promise<T | null | undefined> {
	try {
		const now = Math.floor(Date.now() / 1000);
		const row = await prisma.serviceMapping.findFirst({
			where: { entityType, lfKey, expiresAt: { gt: now } },
			select: { tidalId: true, payload: true },
		});
		if (!row) {
			incr("mapping_miss");
			return undefined;
		}
		if (!row.tidalId) {
			incr("mapping_negative_hit");
			return null;
		}
		incr("mapping_hit");
		return row.payload ? (JSON.parse(row.payload) as T) : undefined;
	} catch {
		// DB not ready / mocked — behave as a miss so resolution still works.
		return undefined;
	}
}

/** Persist a resolution outcome (positive or negative). Best-effort. */
export async function writeMapping(
	entityType: EntityType,
	lfKey: string,
	resolved: {
		tidalId: string | null;
		confidence: number;
		method?: string;
		mbid?: string | null;
		isrc?: string | null;
		payload?: unknown;
	},
): Promise<void> {
	try {
		const now = Math.floor(Date.now() / 1000);
		const positive = resolved.tidalId != null;
		const expiresAt = now + (positive ? POSITIVE_TTL : NEGATIVE_TTL);
		const data = {
			tidalId: resolved.tidalId,
			confidence: resolved.confidence,
			method: resolved.method ?? (positive ? "fuzzy" : "negative"),
			mbid: resolved.mbid ?? null,
			isrc: resolved.isrc ?? null,
			payload:
				positive && resolved.payload ? JSON.stringify(resolved.payload) : null,
			resolvedAt: now,
			expiresAt,
		};
		await prisma.serviceMapping.upsert({
			where: { entityType_lfKey: { entityType, lfKey } },
			create: { entityType, lfKey, ...data },
			update: data,
		});
	} catch {
		// Best-effort; a failed cache write must never break resolution.
	}
}

/**
 * Resolve through the cache: return a fresh hit (positive or negative) without
 * searching; otherwise run `search`, persist the outcome, and return it.
 *
 * `search` returns the matched Tidal entity (or null) plus the confidence and
 * any identifiers worth caching for a later upgrade pass.
 */
export async function resolveCached<T extends { id: string | number }>(
	entityType: EntityType,
	keyParts: string[],
	search: () => Promise<{
		item: T | null;
		confidence: number;
		method?: string;
		mbid?: string | null;
		isrc?: string | null;
	}>,
): Promise<T | null> {
	const lfKey = mappingKey(entityType, keyParts);

	const cached = await readMapping<T>(entityType, lfKey);
	if (cached !== undefined) return cached; // hit: T (positive) or null (negative)

	const { item, confidence, method, mbid, isrc } = await search();
	await writeMapping(entityType, lfKey, {
		tidalId: item ? String(item.id) : null,
		confidence,
		method,
		mbid: mbid ?? (item as any)?.mbid ?? null,
		isrc: isrc ?? (item as any)?.isrc ?? null,
		payload: item ?? undefined,
	});
	return item;
}
