import { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { resolveUser, getDb } from "../db/helpers.js";
import { scheduleProfileUpdate } from "../workers/runner.js";

const HIGH_SIGNAL = new Set([
	"like",
	"save",
	"playlist_add",
	"repeat",
	"follow",
]);

const InteractionBody = z.object({
	trackId: z.string().optional(),
	artistId: z.string().optional(),
	albumId: z.string().optional(),
	eventType: z.enum([
		"play",
		"skip",
		"like",
		"unlike",
		"save",
		"unsave",
		"follow",
		"playlist_add",
		"repeat",
	]),
	playDurationSec: z.number().int().optional(),
	trackDurationSec: z.number().int().optional(),
	sessionId: z.string().optional(),
	context: z.record(z.unknown()).optional(),
	occurredAt: z.number().int().optional(),
});

export async function interactionsRoutes(app: FastifyInstance) {
	app.post<{
		Params: { userId: string };
		Body: z.infer<typeof InteractionBody>;
	}>("/users/:userId/interactions", async (req, reply) => {
		const body = InteractionBody.parse(req.body);
		const externalId = req.params.userId;
		const db = getDb();

		// Resolve or auto-create user
		let user = resolveUser(externalId);
		if (!user) {
			const id = randomUUID();
			db.prepare(
				"INSERT INTO users (id, external_id, is_new) VALUES (?, ?, 1)",
			).run(id, externalId);
			user = resolveUser(externalId)!;
		}

		// Validate track if provided
		if (body.trackId) {
			const track = db
				.prepare("SELECT id FROM tracks WHERE id = ? LIMIT 1")
				.get(body.trackId);
			if (!track)
				return reply
					.status(404)
					.send({ error: `Track ${body.trackId} not found` });
		}

		const completionRatio =
			body.eventType === "play" && body.playDurationSec && body.trackDurationSec
				? body.playDurationSec / body.trackDurationSec
				: null;

		const nowUnix = Math.floor(Date.now() / 1000);
		const result = db
			.prepare(
				`INSERT INTO user_interactions 
				(user_id, track_id, artist_id, album_id, event_type, play_duration_sec, track_duration_sec, completion_ratio, session_id, context, occurred_at) 
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				user.id,
				body.trackId || null,
				body.artistId || null,
				body.albumId || null,
				body.eventType,
				body.playDurationSec || null,
				body.trackDurationSec || null,
				completionRatio,
				body.sessionId || null,
				body.context ? JSON.stringify(body.context) : null,
				body.occurredAt ?? nowUnix,
			);

		if (user.is_new) {
			db.prepare("UPDATE users SET is_new = 0 WHERE id = ?").run(user.id);
		}

		if (HIGH_SIGNAL.has(body.eventType)) {
			scheduleProfileUpdate(user.id);
		}

		return reply.status(201).send({
			id: result.lastInsertRowid,
			userId: user.id,
			eventType: body.eventType,
		});
	});
}
