import { buildHomepageShelvesForExternalUser } from "../../services/homepageBuilder.js";
import { writeHomepageCache } from "../../services/homepageCache.js";

/**
 * Background build of the personalized homepage. Runs the heavy, enriched
 * variant (artist.getSimilar / artist.getTopTracks → Tidal) and persists the
 * result to homepage_cache so the request path can serve it instantly.
 */
export async function handleBuildHomepage(payload: unknown) {
	const { externalId } = payload as { externalId: string };
	if (!externalId) return;
	const built = await buildHomepageShelvesForExternalUser(externalId, {
		enrich: true,
	});
	writeHomepageCache(externalId, built.shelves);
}
