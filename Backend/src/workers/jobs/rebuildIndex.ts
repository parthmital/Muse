import { eq } from "drizzle-orm";
import { db, fromJson } from "../../db/client.js";
import { trackFeatures } from "../../db/schema.js";
import { embeddingClient } from "../../services/embeddingClient.js";

export async function handleRebuildIndex(_payload: unknown) {
	const rows = await db
		.select({
			trackId: trackFeatures.trackId,
			embedding: trackFeatures.embedding,
		})
		.from(trackFeatures)
		.where(eq(trackFeatures.enrichmentStatus, "done"));

	const vectors: Record<string, number[]> = {};
	for (const r of rows) {
		const emb = fromJson<number[]>(r.embedding, []);
		if (emb.length) vectors[r.trackId] = emb;
	}

	console.log(
		`[rebuild_index] rebuilding with ${Object.keys(vectors).length} tracks`,
	);
	await embeddingClient.rebuild(vectors);
}
