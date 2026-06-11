import { FastifyInstance } from "fastify";
import { prisma } from "../db/prisma.js";
import { fromJson } from "../db/helpers.js";
import { upsertHifiTrack } from "../db/repositories/catalog.js";
import { hifiClient } from "../services/hifiClient.js";
import { scheduleEnrichTrack } from "../workers/runner.js";

export async function trackRoutes(app: FastifyInstance) {
	// POST /tracks/ingest – fetch from hifi-api, persist, schedule enrichment
	app.post<{ Body: { trackIds: string[] } }>(
		"/tracks/ingest",
		async (req, reply) => {
			const { trackIds } = req.body;
			if (!Array.isArray(trackIds) || !trackIds.length) {
				return reply.status(400).send({ error: "trackIds array required" });
			}

			const { hifiClient } = await import("../services/hifiClient.js");
			const apiTracks = await hifiClient.getTracks(trackIds);

			const ids = apiTracks.map((t) => String(t.id));
			const existingRows = await prisma.track.findMany({
				where: { id: { in: ids } },
				select: { id: true },
			});
			const existing = new Set(existingRows.map((r) => r.id));

			let newCount = 0;
			for (const t of apiTracks) {
				const trackIdStr = String(t.id);
				if (existing.has(trackIdStr)) continue;
				await upsertHifiTrack(t);
				scheduleEnrichTrack(trackIdStr);
				newCount++;
			}

			return reply
				.status(202)
				.send({ ingested: newCount, total: apiTracks.length });
		},
	);

	// GET /tracks/:trackId  (raw snake_case shape preserved for the frontend)
	app.get<{ Params: { trackId: string } }>(
		"/tracks/:trackId",
		async (req, reply) => {
			const { trackId } = req.params;
			const trackRows = await prisma.$queryRaw<any[]>`
				SELECT * FROM tracks WHERE id = ${trackId} LIMIT 1`;
			const track = trackRows[0];
			if (!track) return reply.status(404).send({ error: "Track not found" });

			const featRows = await prisma.$queryRaw<any[]>`
				SELECT * FROM track_features WHERE track_id = ${trackId} LIMIT 1`;
			const feat = featRows[0];

			return {
				...track,
				mix_ids: fromJson(track.mix_ids, null),
				features: feat
					? { ...feat, mood_tags: fromJson(feat.mood_tags, []) }
					: null,
			};
		},
	);

	// POST /tracks/:trackId/enrich – manually trigger enrichment
	app.post<{ Params: { trackId: string } }>(
		"/tracks/:trackId/enrich",
		async (req, reply) => {
			const track = await prisma.track.findUnique({
				where: { id: req.params.trackId },
				select: { id: true },
			});
			if (!track) return reply.status(404).send({ error: "Track not found" });

			await prisma.trackFeatures.upsert({
				where: { trackId: track.id },
				create: { trackId: track.id, enrichmentStatus: "pending" },
				update: { enrichmentStatus: "pending", errorMessage: null },
			});

			scheduleEnrichTrack(track.id);
			return reply.status(202).send({ status: "scheduled", trackId: track.id });
		},
	);
}
