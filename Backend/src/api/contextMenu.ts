import { FastifyInstance } from "fastify";
import { resolveUser, getDb } from "../db/helpers.js";

export async function contextMenuRoutes(app: FastifyInstance) {
	app.get<{
		Params: { type: string; id: string };
		Querystring: { userId: string };
	}>("/context-menu/:type/:id", async (req, reply) => {
		const { type, id } = req.params;
		const { userId: externalId } = req.query;

		if (!externalId)
			return reply.status(400).send({ error: "userId required" });
		const user = resolveUser(externalId);
		if (!user) return reply.status(404).send({ error: "User not found" });

		const itemType = type === "video" ? "track" : type;
		const db = getDb();
		const inLibrary = db
			.prepare(
				"SELECT id, is_pinned FROM user_library WHERE user_id = ? AND item_id = ? AND item_type = ? LIMIT 1",
			)
			.get(user.id, id, itemType) as
			| { id: number; is_pinned: number }
			| undefined;

		return {
			id,
			type,
			inLibrary: !!inLibrary,
			isPinned: inLibrary ? !!inLibrary.is_pinned : false,
		};
	});
}
