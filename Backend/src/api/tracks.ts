import { FastifyInstance } from "fastify";
import { eq, inArray } from "drizzle-orm";
import { db, fromJson, toJson } from "../db/client.js";
import { tracks, trackFeatures, artists, albums } from "../db/schema.js";
import { hifiClient } from "../services/hifiClient.js";
import { scheduleEnrichTrack } from "../workers/runner.js";
import { invalidateTrack } from "../cache/index.js";

export async function trackRoutes(app: FastifyInstance) {
	// POST /tracks/ingest – fetch from hifi-api, persist, schedule enrichment
	app.post<{ Body: { trackIds: string[] } }>(
		"/tracks/ingest",
		async (req, reply) => {
			const { trackIds } = req.body;
			if (!Array.isArray(trackIds) || !trackIds.length) {
				return reply.status(400).send({ error: "trackIds array required" });
			}

			const apiTracks = await hifiClient.getTracks(trackIds);

			// Find which IDs we don't already have
			const existing = new Set(
				(
					await db
						.select({ id: tracks.id })
						.from(tracks)
						.where(
							inArray(
								tracks.id,
								apiTracks.map((t) => String(t.id)),
							),
						)
				).map((r) => r.id),
			);

			let newCount = 0;
			for (const t of apiTracks) {
				const trackIdStr = String(t.id);
				if (existing.has(trackIdStr)) continue;

				// Upsert artist
				if (t.artist?.id) {
					await db
						.insert(artists)
						.values({
							id: String(t.artist.id),
							name: t.artist.name,
							popularity: t.artist.popularity,
							pictureUrl: t.artist.picture,
							rawApiData: toJson(t.artist),
						})
						.onConflictDoNothing();
				}

				// Upsert album
				if (t.album?.id) {
					await db
						.insert(albums)
						.values({
							id: String(t.album.id),
							title: t.album.title,
							coverUrl: t.album.cover,
							vibrantColor: t.album.vibrantColor,
							rawApiData: toJson(t.album),
						})
						.onConflictDoNothing();
				}

				// Insert track
				await db
					.insert(tracks)
					.values({
						id: trackIdStr,
						title: t.title,
						duration: t.duration,
						bpm: t.bpm,
						key: t.key,
						keyScale: t.keyScale,
						popularity: t.popularity,
						explicit: t.explicit ?? false,
						audioQuality: t.audioQuality,
						isrc: t.isrc,
						mixIds: toJson(t.mixes),
						rawApiData: toJson(t),
						artistId: t.artist?.id ? String(t.artist.id) : null,
						albumId: t.album?.id ? String(t.album.id) : null,
					})
					.onConflictDoNothing();

				// Placeholder features row
				await db
					.insert(trackFeatures)
					.values({
						trackId: trackIdStr,
						enrichmentStatus: "pending",
					})
					.onConflictDoNothing();

				scheduleEnrichTrack(trackIdStr);
				newCount++;
			}

			return reply
				.status(202)
				.send({ ingested: newCount, total: apiTracks.length });
		},
	);

	// GET /tracks/:trackId
	app.get<{ Params: { trackId: string } }>(
		"/tracks/:trackId",
		async (req, reply) => {
			const { trackId } = req.params;
			const [track] = await db
				.select()
				.from(tracks)
				.where(eq(tracks.id, trackId))
				.limit(1);
			if (!track) return reply.status(404).send({ error: "Track not found" });

			const [feat] = await db
				.select()
				.from(trackFeatures)
				.where(eq(trackFeatures.trackId, trackId))
				.limit(1);

			return {
				...track,
				mixIds: fromJson(track.mixIds, null),
				features: feat
					? {
							...feat,
							moodTags: fromJson(feat.moodTags, []),
							embedding: undefined, // never expose raw embedding
						}
					: null,
			};
		},
	);

	// POST /tracks/:trackId/enrich – manually trigger enrichment
	app.post<{ Params: { trackId: string } }>(
		"/tracks/:trackId/enrich",
		async (req, reply) => {
			const [track] = await db
				.select({ id: tracks.id })
				.from(tracks)
				.where(eq(tracks.id, req.params.trackId))
				.limit(1);
			if (!track) return reply.status(404).send({ error: "Track not found" });

			// Reset status so worker picks it up
			await db
				.update(trackFeatures)
				.set({ enrichmentStatus: "pending", errorMessage: null })
				.where(eq(trackFeatures.trackId, track.id));

			invalidateTrack(track.id);
			scheduleEnrichTrack(track.id);
			return reply.status(202).send({ status: "scheduled", trackId: track.id });
		},
	);
}
