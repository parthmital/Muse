import { FastifyInstance } from "fastify";
import { z } from "zod";
import { resolveUser, getDb } from "../db/helpers.js";

const ActionBody = z.object({
	userId: z.string(),
	type: z.string(),
	id: z.string(),
});

export async function actionRoutes(app: FastifyInstance) {
	app.post<{
		Params: { action: string };
		Body: z.infer<typeof ActionBody>;
	}>("/actions/:action", async (req, reply) => {
		const { action } = req.params;
		const { userId: externalId, type, id } = ActionBody.parse(req.body);

		const user = resolveUser(externalId);
		if (!user) return reply.status(404).send({ error: "User not found" });

		const db = getDb();

		switch (action) {
			case "toggle_like":
			case "toggle_library": {
				const existing = db
					.prepare(
						"SELECT id FROM user_library WHERE user_id = ? AND item_id = ? AND item_type = ? LIMIT 1",
					)
					.get(user.id, id, type) as { id: number } | undefined;

				if (existing) {
					db.prepare("DELETE FROM user_library WHERE id = ?").run(existing.id);
					return { success: true, active: false };
				} else {
					db.prepare(
						"INSERT INTO user_library (user_id, item_id, item_type) VALUES (?, ?, ?)",
					).run(user.id, id, type);
					return { success: true, active: true };
				}
			}

			case "toggle_pin": {
				const existing = db
					.prepare(
						"SELECT id, is_pinned FROM user_library WHERE user_id = ? AND item_id = ? AND item_type = ? LIMIT 1",
					)
					.get(user.id, id, type) as
					| { id: number; is_pinned: number }
					| undefined;

				if (existing) {
					const newPinned = existing.is_pinned ? 0 : 1;
					db.prepare("UPDATE user_library SET is_pinned = ? WHERE id = ?").run(
						newPinned,
						existing.id,
					);
					return { success: true, active: !!newPinned };
				} else {
					db.prepare(
						"INSERT INTO user_library (user_id, item_id, item_type, is_pinned) VALUES (?, ?, ?, 1)",
					).run(user.id, id, type);
					return { success: true, active: true };
				}
			}

			case "shuffle_play":
			case "radio":
			case "mix":
			case "play_next":
			case "add_to_queue":
				return { success: true, message: `Action ${action} ready` };

			default:
				return reply.status(400).send({ error: `Unknown action: ${action}` });
		}
	});
}
