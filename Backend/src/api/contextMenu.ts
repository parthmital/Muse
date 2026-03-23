import { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { users, userLibrary } from "../db/schema.js";

async function resolveUser(externalId: string) {
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.externalId, externalId))
		.limit(1);
	return user ?? null;
}

export async function contextMenuRoutes(app: FastifyInstance) {
	app.get<{
		Params: { type: string; id: string };
		Querystring: { userId: string };
	}>("/context-menu/:type/:id", async (req, reply) => {
		const { type, id } = req.params;
		const { userId: externalId } = req.query;

		if (!externalId)
			return reply.status(400).send({ error: "userId required" });
		const user = await resolveUser(externalId);
		if (!user) return reply.status(404).send({ error: "User not found" });

		// Check statuses to dynamically change labels (Like -> Unlike, etc.)
		const [inLibrary] = await db
			.select()
			.from(userLibrary)
			.where(
				and(
					eq(userLibrary.userId, user.id),
					eq(userLibrary.itemId, id),
					eq(userLibrary.itemType, type === "video" ? "track" : (type as any)),
				),
			)
			.limit(1);

		const isPinned = inLibrary?.isPinned ?? false;
		return {
			id,
			type,
			inLibrary: !!inLibrary,
			isPinned,
		};
	});
}
