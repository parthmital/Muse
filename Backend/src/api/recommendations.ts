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
import { hifiClient } from "../services/hifiClient.js";

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

function totalShelfItems(shelves: Array<{ items: unknown[] }>): number {
	return shelves.reduce((sum, shelf) => sum + shelf.items.length, 0);
}

async function buildExternalFallbackShelves(req: any) {
	const [trackRes, albumRes, artistRes] = await Promise.allSettled([
		hifiClient.searchTracks("trending", 10),
		hifiClient.searchAlbums("new releases", 10),
		hifiClient.searchArtists("popular", 8),
	]);

	if (trackRes.status === "rejected") {
		req.log.warn(
			{ error: trackRes.reason },
			"homepage fallback: track source failed",
		);
	}
	if (albumRes.status === "rejected") {
		req.log.warn(
			{ error: albumRes.reason },
			"homepage fallback: album source failed",
		);
	}
	if (artistRes.status === "rejected") {
		req.log.warn(
			{ error: artistRes.reason },
			"homepage fallback: artist source failed",
		);
	}

	const tracks = trackRes.status === "fulfilled" ? trackRes.value.items : [];
	const albums = albumRes.status === "fulfilled" ? albumRes.value.items : [];
	const artists =
		artistRes.status === "fulfilled"
			? (artistRes.value.artists?.items ?? [])
			: [];

	return [
		{
			title: "Trending Tracks",
			type: "tracks",
			items: tracks.map((t) => ({
				id: t.id,
				title: t.album?.title ?? t.title,
				artist: t.artist?.name ?? t.artists?.[0]?.name,
				tidalId: t.album?.id ?? t.id,
				imageUrl: hifiClient.tidalImageUrl(t.album?.cover),
				type: "album",
			})),
		},
		{
			title: "Popular Artists",
			type: "artists",
			items: artists.map((a) => ({
				id: a.id,
				title: a.name,
				tidalId: a.id,
				imageUrl: hifiClient.tidalImageUrl(a.picture),
				type: "artist",
			})),
		},
		{
			title: "New Albums",
			type: "albums",
			items: albums.map((al: any) => ({
				id: al.id,
				title: al.title,
				artist: al.artist?.name ?? al.artists?.[0]?.name,
				tidalId: al.id,
				imageUrl: hifiClient.tidalImageUrl(al.cover),
				type: "album",
				songs: al.numberOfTracks,
			})),
		},
	];
}

function buildStaticFallbackShelves() {
	return [
		{
			title: "Get Started",
			type: "albums",
			items: [
				{
					id: "starter-1",
					title: "Start Exploring",
					artist: "Muse",
					tidalId: "starter-1",
					imageUrl: null,
					type: "album",
				},
				{
					id: "starter-2",
					title: "Try Search",
					artist: "Muse",
					tidalId: "starter-2",
					imageUrl: null,
					type: "album",
				},
				{
					id: "starter-3",
					title: "Build Your Library",
					artist: "Muse",
					tidalId: "starter-3",
					imageUrl: null,
					type: "album",
				},
			],
		},
	];
}

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

			try {
				const [madeForYou, topMixes, favouriteArtists, albumsForYou] =
					await Promise.all([
						getMadeForYou(user.id, 10),
						getTopMixes(user.id, 6),
						getFavouriteArtists(user.id, 8),
						getAlbumsForYou(user.id, 10),
					]);

				req.log.info(
					{
						userId: req.params.userId,
						madeForYouCount: madeForYou.length,
						topMixesCount: topMixes.length,
						favouriteArtistsCount: favouriteArtists.length,
						albumsForYouCount: albumsForYou.length,
					},
					"users/:userId/homepage source counts",
				);

				let shelves = [
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
				];

				if (totalShelfItems(shelves) === 0) {
					req.log.warn(
						{ userId: req.params.userId },
						"Personalized homepage returned zero items. Trying external fallback.",
					);
					shelves = await buildExternalFallbackShelves(req);
				}

				if (totalShelfItems(shelves) === 0) {
					req.log.warn(
						{ userId: req.params.userId },
						"External fallback also returned zero items. Using static starter fallback.",
					);
					shelves = buildStaticFallbackShelves();
				}

				return {
					userId: req.params.userId,
					generatedAt: Date.now(),
					shelves,
				};
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
}
