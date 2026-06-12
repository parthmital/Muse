import { FastifyInstance } from "fastify";
import { resolveUser } from "../db/repositories/users.js";
import { buildProfile, getProfile } from "../services/profileBuilder.js";
import { topTracks, topArtists } from "../db/repositories/insights.js";
import { ensureSelf } from "../auth.js";

function parseLimit(raw: unknown, fallback: number, max: number): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n <= 0) return fallback;
	return Math.min(Math.floor(n), max);
}

export async function userRoutes(app: FastifyInstance) {
	app.get<{ Params: { userId: string } }>(
		"/users/:userId/profile",
		async (req, reply) => {
			const user = await resolveUser(req.params.userId);
			if (!user) return reply.status(404).send({ error: "User not found" });

			const profile = await getProfile(user.id);
			if (!profile)
				return reply.status(404).send({ error: "Profile not built yet" });

			return {
				userId: req.params.userId,
				preferredGenres: profile.preferredGenres,
				totalPlayCount: profile.totalPlayCount,
			};
		},
	);

	app.post<{ Params: { userId: string } }>(
		"/users/:userId/profile/rebuild",
		async (req, reply) => {
			const user = await resolveUser(req.params.userId);
			if (!user) return reply.status(404).send({ error: "User not found" });

			const profile = await buildProfile(user.id);
			if (!profile)
				return reply.status(422).send({ error: "Not enough interaction data" });

			return { status: "rebuilt", userId: req.params.userId };
		},
	);

	app.get<{ Params: { userId: string }; Querystring: { limit?: string } }>(
		"/users/:userId/top-tracks",
		async (req, reply) => {
			if (!ensureSelf(req, reply, req.params.userId)) return;
			const user = await resolveUser(req.params.userId);
			if (!user) return reply.status(404).send({ error: "User not found" });

			const limit = parseLimit(req.query.limit, 10, 50);
			return { tracks: await topTracks(user.id, limit) };
		},
	);

	app.get<{ Params: { userId: string }; Querystring: { limit?: string } }>(
		"/users/:userId/top-artists",
		async (req, reply) => {
			if (!ensureSelf(req, reply, req.params.userId)) return;
			const user = await resolveUser(req.params.userId);
			if (!user) return reply.status(404).send({ error: "User not found" });

			const limit = parseLimit(req.query.limit, 10, 50);
			return { artists: await topArtists(user.id, limit) };
		},
	);
}
