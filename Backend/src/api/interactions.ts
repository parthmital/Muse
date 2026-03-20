import { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/client.js";
import { users, userInteractions, tracks } from "../db/schema.js";
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
	occurredAt: z.number().int().optional(), // unix seconds
});

export async function interactionsRoutes(app: FastifyInstance) {
	app.post<{
		Params: { userId: string };
		Body: z.infer<typeof InteractionBody>;
	}>("/users/:userId/interactions", async (req, reply) => {
		const body = InteractionBody.parse(req.body);
		const externalId = req.params.userId;

		// Auto-create user on first interaction
		let [user] = await db
			.select()
			.from(users)
			.where(eq(users.externalId, externalId))
			.limit(1);
		if (!user) {
			const id = randomUUID();
			await db.insert(users).values({ id, externalId, isNew: true });
			[user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
		}

		// Validate track if provided
		if (body.trackId) {
			const [t] = await db
				.select({ id: tracks.id })
				.from(tracks)
				.where(eq(tracks.id, body.trackId))
				.limit(1);
			if (!t)
				return reply
					.status(404)
					.send({ error: `Track ${body.trackId} not found` });
		}

		const completionRatio =
			body.eventType === "play" && body.playDurationSec && body.trackDurationSec
				? body.playDurationSec / body.trackDurationSec
				: null;

		const nowUnix = Math.floor(Date.now() / 1000);
		const result = await db
			.insert(userInteractions)
			.values({
				userId: user.id,
				trackId: body.trackId,
				artistId: body.artistId,
				albumId: body.albumId,
				eventType: body.eventType,
				playDurationSec: body.playDurationSec,
				trackDurationSec: body.trackDurationSec,
				completionRatio,
				sessionId: body.sessionId,
				context: body.context ? JSON.stringify(body.context) : null,
				occurredAt: body.occurredAt ?? nowUnix,
			})
			.returning({ id: userInteractions.id });

		if (user.isNew) {
			await db.update(users).set({ isNew: false }).where(eq(users.id, user.id));
		}

		if (HIGH_SIGNAL.has(body.eventType)) {
			scheduleProfileUpdate(user.id);
		}

		return reply
			.status(201)
			.send({ id: result[0].id, userId: user.id, eventType: body.eventType });
	});
}
