/**
 * src/scripts/regenerateSystemMixes.ts
 *
 * One-off maintenance: rebuild persisted system mixes (`sys-mix-*`) and the
 * homepage cache for affected users using the enriched (Last.fm + Tidal) path.
 *
 * Why: before the relevance fixes, artist mixes were padded from an arbitrary
 * track pool that was itself polluted by a keyword-search fallback, so the tail
 * of every mix drifted off-theme (e.g. a "Kanye West Mix" ending in sleep music
 * and tracks merely titled "Viral"/"Trending"). Fixing the code stops *new*
 * mixes from degrading, but already-persisted playlist_tracks must be rebuilt.
 *
 * `buildHomepageShelvesForExternalUser({ enrich: true })` calls
 * persistSystemPlaylist, which deletes and recreates each mix's tracks — so this
 * overwrites the stale mixes in place.
 *
 * REQUIRES the hifi-api Tidal proxy (TIDAL_API_BASE_URL) and LASTFM_API_KEY to
 * be live — otherwise track resolution yields nothing and mixes degrade. Run it
 * with the full stack up.
 *
 * Usage:
 *   npm run regen:mixes                # all users with persisted sys-mix mixes
 *   npm run regen:mixes -- dev-user-001 other-user   # specific external ids
 */

import { prisma, initDb, disconnectDb } from "../db/prisma.js";
import { buildHomepageShelvesForExternalUser } from "../services/homepageBuilder.js";
import { writeHomepageCache } from "../services/homepageCache.js";
import { logger } from "../logger.js";

const log = logger.child({ scope: "regen-mixes" });

async function affectedExternalIds(): Promise<string[]> {
	const rows = await prisma.$queryRaw<Array<{ user_id: string }>>`
		SELECT DISTINCT user_id FROM playlists WHERE id LIKE 'sys-mix-%'`;
	return rows.map((r) => String(r.user_id)).filter(Boolean);
}

async function main(): Promise<void> {
	await initDb();

	const fromArgs = process.argv.slice(2).filter(Boolean);
	const externalIds = fromArgs.length ? fromArgs : await affectedExternalIds();

	if (!externalIds.length) {
		log.info("No users with persisted system mixes — nothing to regenerate.");
		return;
	}

	log.info(
		{ count: externalIds.length, externalIds },
		"Regenerating system mixes",
	);

	let ok = 0;
	for (const externalId of externalIds) {
		try {
			const built = await buildHomepageShelvesForExternalUser(externalId, {
				enrich: true,
			});
			await writeHomepageCache(externalId, built.shelves);
			ok += 1;
			log.info({ externalId }, "Rebuilt mixes + homepage cache");
		} catch (err) {
			log.error(
				{ err, externalId },
				"Failed to regenerate — left existing mixes in place",
			);
		}
	}

	log.info({ ok, total: externalIds.length }, "Regeneration complete");
}

main()
	.catch((err) => {
		log.error({ err }, "Regeneration script failed");
		process.exitCode = 1;
	})
	.finally(() => disconnectDb());
