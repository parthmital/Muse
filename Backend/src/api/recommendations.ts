import { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { recommend } from "../services/recommender.js";
import { initQueue, updateQueue, getQueue } from "../services/queueManager.js";

const SURFACES = ["queue", "home", "discover", "daily_mix"] as const;

async function resolveUser(externalId: string) {
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.externalId, externalId))
		.limit(1);
	return user ?? null;
}

export async function recommendationRoutes(app: FastifyInstance) {
	// GET /users/:userId/recommendations
	app.get<{
		Params: { userId: string };
		Querystring: { surface?: string; seedTrackId?: string; limit?: string };
	}>("/users/:userId/recommendations", async (req, reply) => {
		const user = await resolveUser(req.params.userId);
		if (!user) return reply.status(404).send({ error: "User not found" });

		const surface = SURFACES.includes(req.query.surface as any)
			? (req.query.surface as (typeof SURFACES)[number])
			: "home";
		const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;

		const tracks = await recommend({
			userId: user.id,
			surface,
			seedTrackId: req.query.seedTrackId,
			limit,
		});

		return {
			userId: req.params.userId,
			surface,
			tracks,
			generatedAt: Date.now(),
		};
	});

	// POST /users/:userId/queue/init
	app.post<{
		Params: { userId: string };
		Querystring: { sessionId: string; seedTrackId?: string };
	}>("/users/:userId/queue/init", async (req, reply) => {
		const user = await resolveUser(req.params.userId);
		if (!user) return reply.status(404).send({ error: "User not found" });

		const { sessionId, seedTrackId } = req.query;
		if (!sessionId)
			return reply.status(400).send({ error: "sessionId required" });

		const tracks = await initQueue({ userId: user.id, sessionId, seedTrackId });
		return reply.status(201).send({ sessionId, tracks, updatedAt: Date.now() });
	});

	// POST /users/:userId/queue/update
	const UpdateQueueBody = z.object({
		sessionId: z.string(),
		currentTrackId: z.string(),
		playedRatio: z.number().min(0).max(1),
	});

	app.post<{
		Params: { userId: string };
		Body: z.infer<typeof UpdateQueueBody>;
	}>("/users/:userId/queue/update", async (req, reply) => {
		const user = await resolveUser(req.params.userId);
		if (!user) return reply.status(404).send({ error: "User not found" });

		const body = UpdateQueueBody.parse(req.body);
		const tracks = await updateQueue({ userId: user.id, ...body });
		return { sessionId: body.sessionId, tracks, updatedAt: Date.now() };
	});

	// GET /users/:userId/queue
	app.get<{
		Params: { userId: string };
		Querystring: { sessionId: string };
	}>("/users/:userId/queue", async (req, reply) => {
		const { sessionId } = req.query;
		if (!sessionId)
			return reply.status(400).send({ error: "sessionId required" });
		const tracks = await getQueue(sessionId);
		return { sessionId, tracks };
	});
}
