/**
 * src/services/homepageCache.ts
 *
 * Homepage cache + request-path serving. Separated from homepageBuilder (which
 * generates shelf content) so persistence/serving concerns don't live inside
 * the content builder.
 *
 * The heavy, enriched build runs in the background worker and is persisted to
 * homepage_cache. The request path reads the cache and only builds inline as a
 * cold-start fallback (fast, un-enriched), enqueuing an enriched rebuild.
 */
import { prisma } from "../db/prisma.js";
import { fromJson, toJson } from "../db/helpers.js";
import { config } from "../config.js";
import { enqueueJob } from "../db/repositories/jobs.js";
import {
	buildHomepageShelvesForExternalUser,
	resolveOrCreateUser,
	type HomepageShelf,
} from "./homepageBuilder.js";

const HOMEPAGE_FRESH_SEC = config.homepageFreshSec;

async function readHomepageCache(
	externalId: string,
): Promise<{ shelves: HomepageShelf[]; builtAt: number } | null> {
	try {
		const row = await prisma.homepageCache.findUnique({
			where: { userId: externalId },
		});
		if (!row) return null;
		return {
			shelves: fromJson<HomepageShelf[]>(row.shelves, []),
			builtAt: row.builtAt,
		};
	} catch {
		return null;
	}
}

export async function writeHomepageCache(
	externalId: string,
	shelves: HomepageShelf[],
): Promise<void> {
	try {
		const builtAt = Math.floor(Date.now() / 1000);
		const serialized = toJson(shelves);
		await prisma.homepageCache.upsert({
			where: { userId: externalId },
			create: { userId: externalId, shelves: serialized, builtAt },
			update: { shelves: serialized, builtAt },
		});
	} catch {
		// Best-effort.
	}
}

async function enqueueHomepageBuild(externalId: string): Promise<void> {
	try {
		// Deduped on external id by the jobs repository — no manual pending scan.
		await enqueueJob("build_homepage", { externalId }, externalId);
	} catch {
		// Best-effort.
	}
}

async function logShelfImpressions(
	userId: string,
	shelves: HomepageShelf[],
): Promise<void> {
	try {
		const data = shelves.flatMap((shelf) =>
			shelf.items.map((item) => ({
				userId,
				itemType: item.type,
				itemId: String(item.id),
			})),
		);
		if (data.length) await prisma.shelfImpression.createMany({ data });
	} catch {
		// Impression logging is non-critical.
	}
}

/**
 * Request-path entry point: serve the precomputed homepage when available,
 * otherwise build a fast (un-enriched) version inline and queue an enriched
 * rebuild. Always logs impressions so over-exposed items can be decayed.
 */
export async function getHomepageShelves(externalId: string): Promise<{
	userId: string;
	generatedAt: number;
	shelves: HomepageShelf[];
}> {
	const user = await resolveOrCreateUser(externalId);
	const nowSec = Math.floor(Date.now() / 1000);
	const cached = await readHomepageCache(externalId);

	if (cached && cached.shelves.length) {
		// Stale → serve immediately but trigger an enriched rebuild.
		if (nowSec - cached.builtAt > HOMEPAGE_FRESH_SEC) {
			await enqueueHomepageBuild(externalId);
		}
		await logShelfImpressions(user.id, cached.shelves);
		return {
			userId: externalId,
			generatedAt: cached.builtAt * 1000,
			shelves: cached.shelves,
		};
	}

	// Cold start: build fast (no heavy enrichment), cache, queue enriched rebuild.
	const built = await buildHomepageShelvesForExternalUser(externalId, {
		enrich: false,
	});
	await writeHomepageCache(externalId, built.shelves);
	await enqueueHomepageBuild(externalId);
	await logShelfImpressions(user.id, built.shelves);
	return built;
}
