import { FastifyInstance } from "fastify";
import { z } from "zod";
import { resolveUser, getDb } from "../db/helpers.js";
import {
	recommend,
	pickRadioSeeds,
	getMadeForYou,
	getFavouriteArtists,
	getAlbumsForYou,
	getTopMixes,
} from "../services/recommender.js";
import { initQueue, updateQueue, getQueue } from "../services/queueManager.js";

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

export async function recommendationRoutes(app: FastifyInstance) {
	app.get<{
		Params: { userId: string };
		Querystring: { surface?: string; seedTrackId?: string; limit?: string };
	}>("/users/:userId/recommendations", async (req, reply) => {
		const user = resolveUser(req.params.userId);
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
			const user = resolveUser(req.params.userId);
			if (!user) return reply.status(404).send({ error: "User not found" });
			const seeds = await pickRadioSeeds(user.id);
			return { userId: req.params.userId, seeds };
		},
	);

	app.post<{
		Params: { userId: string };
		Querystring: { sessionId: string; seedTrackId?: string };
	}>("/users/:userId/queue/init", async (req, reply) => {
		const user = resolveUser(req.params.userId);
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
		const user = resolveUser(req.params.userId);
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
			const user = resolveUser(req.params.userId);
			if (!user) return reply.status(404).send({ error: "User not found" });

			const [madeForYou, topMixes, favouriteArtists, albumsForYou] =
				await Promise.all([
					getMadeForYou(user.id, 10),
					getTopMixes(user.id, 6),
					getFavouriteArtists(user.id, 8),
					getAlbumsForYou(user.id, 10),
				]);

			return {
				userId: req.params.userId,
				generatedAt: Date.now(),
				shelves: [
					{
						title: "Made For You",
						type: "tracks",
						items: madeForYou.map((t) => ({
							id: t.trackId,
							title: t.title,
							artist: t.artistName,
							tidalId: t.trackId,
							imageUrl: t.coverUrl,
							type: "track",
						})),
					},
					{
						title: "Your Top Mixes",
						type: "mixes",
						items: topMixes.map((m) => ({
							id: m.mixId,
							title: m.title,
							tidalId: m.mixId,
							imageUrl: m.coverUrl,
							type: "mix",
						})),
					},
					{
						title: "Your Favourite Artists",
						type: "artists",
						items: favouriteArtists.map((a) => ({
							id: a.artistId,
							title: a.name,
							tidalId: a.artistId,
							imageUrl: a.pictureUrl,
							type: "artist",
						})),
					},
					{
						title: "Albums For You",
						type: "albums",
						items: albumsForYou.map((a) => ({
							id: a.albumId,
							title: a.title,
							artist: a.artistName,
							tidalId: a.albumId,
							imageUrl: a.coverUrl,
							type: "album",
						})),
					},
				],
			};
		},
	);
}
