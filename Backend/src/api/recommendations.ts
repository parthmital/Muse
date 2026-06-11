import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { resolveUser } from "../db/repositories/users.js";
import { recommend, pickRadioSeeds } from "../services/recommender.js";
import { initQueue, updateQueue, getQueue } from "../services/queueManager.js";
import { buildHomepageShelvesForExternalUser } from "../services/homepageBuilder.js";
import { getHomepageShelves } from "../services/homepageCache.js";

const SURFACES = [
	"queue",
	"home",
	"discover",
	"daily_mix",
	"radio",
	"made_for_you",
	"top_mixes",
	"favourite_artists",
	"albums_for_you",
] as const;

type HomepageShelfItem = {
	id: string | number;
	title: string;
	tidalId: string | number;
	imageUrl: string | null;
	type: string;
	artist?: string | null;
	songs?: number;
};

export async function recommendationRoutes(app: FastifyInstance) {
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

	app.get<{ Params: { userId: string } }>(
		"/users/:userId/radio/seeds",
		async (req, reply) => {
			const user = await resolveUser(req.params.userId);
			if (!user) return reply.status(404).send({ error: "User not found" });
			const seeds = await pickRadioSeeds(user.id);
			return { userId: req.params.userId, seeds };
		},
	);

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

	// ── Homepage Personalized Sections ───────────────────────────────────────────

	app.get<{ Params: { userId: string } }>(
		"/users/:userId/homepage",
		async (req, reply) => {
			reply.header(
				"Cache-Control",
				"private, max-age=15, stale-while-revalidate=60",
			);
			try {
				const homepage = await getHomepageShelves(req.params.userId);
				req.log.info(
					{
						userId: req.params.userId,
						shelves: homepage.shelves.map((shelf) => ({
							title: shelf.title,
							count: shelf.items.length,
						})),
					},
					"users/:userId/homepage served shelves",
				);
				return homepage;
			} catch (error) {
				req.log.error(
					{
						error,
						userId: req.params.userId,
					},
					"Failed to build personalized homepage shelves",
				);

				return reply.status(500).send({
					error: "Failed to build personalized homepage",
					userId: req.params.userId,
				});
			}
		},
	);

	app.get<{ Params: { userId: string } }>(
		"/users/:userId/homepage/debug",
		async (req, reply) => {
			try {
				const homepage = await buildHomepageShelvesForExternalUser(
					req.params.userId,
				);

				const sectionChecks = homepage.shelves.map((shelf) => {
					const itemCount = shelf.items.length;
					return {
						title: shelf.title,
						itemCount,
						exactly10Ok: itemCount === 10,
					};
				});

				const collectionItems = homepage.shelves.flatMap((shelf) =>
					shelf.items.filter(
						(item: HomepageShelfItem) =>
							item.type === "mix" || item.type === "playlist",
					),
				);
				const collectionChecks = await Promise.all(
					collectionItems.map(async (item: HomepageShelfItem) => {
						const playlistId = String(item.tidalId);
						const c = await prisma.playlistTrack.count({
							where: { playlistId },
						});
						return {
							id: playlistId,
							title: item.title,
							type: item.type,
							tracksInDb: c,
							exactly50Ok: c === 50,
						};
					}),
				);

				return {
					userId: req.params.userId,
					generatedAt: homepage.generatedAt,
					sectionChecks,
					collectionChecks,
					allSectionsHaveExactly10: sectionChecks.every((s) => s.exactly10Ok),
					allCollectionsHave50: collectionChecks.every((c) => c.exactly50Ok),
				};
			} catch (error) {
				req.log.error(
					{
						error,
						userId: req.params.userId,
					},
					"Failed to build homepage debug payload",
				);
				return reply.status(500).send({
					error: "Failed to build homepage debug payload",
					userId: req.params.userId,
				});
			}
		},
	);
}
