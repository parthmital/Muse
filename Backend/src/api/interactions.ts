import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { resolveUser, ensureUser } from "../db/repositories/users.js";
import { toJson } from "../db/helpers.js";
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

		// Resolve or auto-create user
		let user = await resolveUser(externalId);
		if (!user) user = await ensureUser(externalId, externalId, 1);

		// Validate track if provided
		if (body.trackId) {
			const track = await prisma.track.findUnique({
				where: { id: body.trackId },
				select: { id: true },
			});
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
		const created = await prisma.userInteraction.create({
			data: {
				userId: user.id,
				trackId: body.trackId || null,
				artistId: body.artistId || null,
				albumId: body.albumId || null,
				eventType: body.eventType,
				playDurationSec: body.playDurationSec ?? null,
				trackDurationSec: body.trackDurationSec ?? null,
				completionRatio,
				sessionId: body.sessionId || null,
				context: body.context ? toJson(body.context) : null,
				occurredAt: body.occurredAt ?? nowUnix,
			},
			select: { id: true },
		});

		if (user.isNew) {
			await prisma.user.update({
				where: { id: user.id },
				data: { isNew: 0 },
			});
		}

		if (HIGH_SIGNAL.has(body.eventType)) {
			scheduleProfileUpdate(user.id);
		}

		return reply.status(201).send({
			id: created.id,
			userId: user.id,
			eventType: body.eventType,
		});
	});
}
