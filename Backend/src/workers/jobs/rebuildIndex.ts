import { getDb, fromJson } from "../../db/helpers.js";
import { embeddingClient } from "../../services/embeddingClient.js";

export async function handleRebuildIndex(_payload: unknown) {
	const db = getDb();
	const rows = db
		.prepare(
			"SELECT track_id, embedding FROM track_features WHERE enrichment_status = 'done'",
		)
		.all() as any[];

	const vectors: Record<string, number[]> = {};
	for (const r of rows) {
		const emb = fromJson<number[]>(r.embedding, []);
		if (emb.length) vectors[r.track_id] = emb;
	}

	console.log(
		`[rebuild_index] rebuilding with ${Object.keys(vectors).length} tracks`,
	);
	await embeddingClient.rebuild(vectors);
}
