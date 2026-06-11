import { FastifyInstance } from "fastify";
import { resolveUser } from "../db/repositories/users.js";
import { buildProfile, getProfile } from "../services/profileBuilder.js";

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
}
