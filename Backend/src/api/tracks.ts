import { FastifyInstance } from "fastify";
import { getDb, toJson, fromJson } from "../db/helpers.js";
import { hifiClient } from "../services/hifiClient.js";
import { scheduleEnrichTrack } from "../workers/runner.js";
import { invalidateTrack } from "../cache/index.js";

export async function trackRoutes(app: FastifyInstance) {
	const db = getDb();

	// POST /tracks/ingest – fetch from hifi-api, persist, schedule enrichment
	app.post<{ Body: { trackIds: string[] } }>(
		"/tracks/ingest",
		async (req, reply) => {
			const { trackIds } = req.body;
			if (!Array.isArray(trackIds) || !trackIds.length) {
				return reply.status(400).send({ error: "trackIds array required" });
			}

			const apiTracks = await hifiClient.getTracks(trackIds);

			const existingRows = db
				.prepare(
					`SELECT id FROM tracks WHERE id IN (${apiTracks.map(() => "?").join(",")})`,
				)
				.all(...apiTracks.map((t) => String(t.id))) as { id: string }[];
			const existing = new Set(existingRows.map((r) => r.id));

			const insertArtist = db.prepare(
				"INSERT OR IGNORE INTO artists (id, name, popularity, picture_url, raw_api_data) VALUES (?, ?, ?, ?, ?)",
			);
			const insertAlbum = db.prepare(
				"INSERT OR IGNORE INTO albums (id, title, cover_url, vibrant_color, raw_api_data) VALUES (?, ?, ?, ?, ?)",
			);
			const insertTrack = db.prepare(
				`INSERT OR IGNORE INTO tracks 
				(id, title, duration, bpm, key, key_scale, popularity, explicit, audio_quality, isrc, mix_ids, raw_api_data, artist_id, album_id) 
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			);
			const insertFeatures = db.prepare(
				"INSERT OR IGNORE INTO track_features (track_id, enrichment_status) VALUES (?, 'pending')",
			);

			const ingestBatch = db.transaction(() => {
				let newCount = 0;
				for (const t of apiTracks) {
					const trackIdStr = String(t.id);
					if (existing.has(trackIdStr)) continue;

					if (t.artist?.id) {
						insertArtist.run(
							String(t.artist.id),
							t.artist.name,
							t.artist.popularity ?? null,
							t.artist.picture ?? null,
							toJson(t.artist),
						);
					}

					if (t.album?.id) {
						insertAlbum.run(
							String(t.album.id),
							t.album.title,
							t.album.cover ?? null,
							t.album.vibrantColor ?? null,
							toJson(t.album),
						);
					}

					insertTrack.run(
						trackIdStr,
						t.title,
						t.duration ?? null,
						t.bpm ?? null,
						t.key ?? null,
						t.keyScale ?? null,
						t.popularity ?? null,
						t.explicit ? 1 : 0,
						t.audioQuality ?? null,
						t.isrc ?? null,
						toJson(t.mixes),
						toJson(t),
						t.artist?.id ? String(t.artist.id) : null,
						t.album?.id ? String(t.album.id) : null,
					);

					insertFeatures.run(trackIdStr);
					scheduleEnrichTrack(trackIdStr);
					newCount++;
				}
				return newCount;
			});

			const newCount = ingestBatch();

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
			const track = db
				.prepare("SELECT * FROM tracks WHERE id = ? LIMIT 1")
				.get(trackId) as any;
			if (!track) return reply.status(404).send({ error: "Track not found" });

			const feat = db
				.prepare("SELECT * FROM track_features WHERE track_id = ? LIMIT 1")
				.get(trackId) as any;

			return {
				...track,
				mix_ids: fromJson(track.mix_ids, null),
				features: feat
					? {
							...feat,
							mood_tags: fromJson(feat.mood_tags, []),
							embedding: undefined,
						}
					: null,
			};
		},
	);

	// POST /tracks/:trackId/enrich – manually trigger enrichment
	app.post<{ Params: { trackId: string } }>(
		"/tracks/:trackId/enrich",
		async (req, reply) => {
			const track = db
				.prepare("SELECT id FROM tracks WHERE id = ? LIMIT 1")
				.get(req.params.trackId) as { id: string } | undefined;
			if (!track) return reply.status(404).send({ error: "Track not found" });

			db.prepare(
				"UPDATE track_features SET enrichment_status = 'pending', error_message = NULL WHERE track_id = ?",
			).run(track.id);

			invalidateTrack(track.id);
			scheduleEnrichTrack(track.id);
			return reply.status(202).send({ status: "scheduled", trackId: track.id });
		},
	);
}
