import { FastifyInstance } from "fastify";
import { resolveUser } from "../db/repositories/users.js";
import { getLibraryEntry } from "../db/repositories/library.js";
import { ensureSelf } from "../auth.js";

export async function contextMenuRoutes(app: FastifyInstance) {
	app.get<{
		Params: { type: string; id: string };
		Querystring: { userId: string };
	}>("/context-menu/:type/:id", async (req, reply) => {
		const { type, id } = req.params;
		const { userId: externalId } = req.query;

		if (!externalId)
			return reply.status(400).send({ error: "userId required" });
		if (!ensureSelf(req, reply, externalId)) return;
		const user = await resolveUser(externalId);
		if (!user) return reply.status(404).send({ error: "User not found" });

		// Track/video "Like" state lives in the "liked_track" bucket (shared with
		// the heart button), so the menu's active state matches it.
		const itemType =
			type === "track" || type === "video" ? "liked_track" : type;
		const inLibrary = await getLibraryEntry(user.id, itemType, id);

		return {
			id,
			type,
			inLibrary: !!inLibrary,
			isPinned: inLibrary ? !!inLibrary.isPinned : false,
		};
	});
}
