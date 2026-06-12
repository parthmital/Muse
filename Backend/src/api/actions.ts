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
			case "toggle_like": {
				// Track/video likes share the "liked_track" bucket with the heart
				// button (useSongActions) so both controls — and the Liked page —
				// stay in sync. Other types (artist/mix) keep their own bucket.
				const itemType =
					type === "track" || type === "video" ? "liked_track" : type;
				const active = await toggleLibraryItem(user.id, itemType, id);
				return { success: true, active };
			}
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
