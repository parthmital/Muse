import { FastifyInstance } from "fastify";
import { z } from "zod";
import { resolveUser } from "../db/repositories/users.js";
import { toggleLibraryItem, togglePin } from "../db/repositories/library.js";
import { ensureSelf } from "../auth.js";

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

		if (!ensureSelf(req, reply, externalId)) return;

		const user = await resolveUser(externalId);
		if (!user) return reply.status(404).send({ error: "User not found" });

		switch (action) {
			case "toggle_like":
			case "toggle_library": {
				const active = await toggleLibraryItem(user.id, type, id);
				return { success: true, active };
			}

			case "toggle_pin": {
				const active = await togglePin(user.id, type, id);
				return { success: true, active };
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
