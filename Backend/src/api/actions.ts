import { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import {
	users,
	userLibrary,
	blockedItems,
	playlists,
	playlistTracks,
} from "../db/schema.js";

async function resolveUser(externalId: string) {
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.externalId, externalId))
		.limit(1);
	return user ?? null;
}

const ActionBody = z.object({
	userId: z.string(),
	type: z.string(), // track, album, artist, playlist, etc.
	id: z.string(),
	target: z.string().optional(), // for block action (track, album, artist)
});

export async function actionRoutes(app: FastifyInstance) {
	app.post<{
		Params: { action: string };
		Body: z.infer<typeof ActionBody>;
	}>("/actions/:action", async (req, reply) => {
		const { action } = req.params;
		const { userId: externalId, type, id, target } = ActionBody.parse(req.body);

		const user = await resolveUser(externalId);
		if (!user) return reply.status(404).send({ error: "User not found" });

		switch (action) {
			case "toggle_like":
			case "toggle_library": {
				const [existing] = await db
					.select()
					.from(userLibrary)
					.where(
						and(
							eq(userLibrary.userId, user.id),
							eq(userLibrary.itemId, id),
							eq(userLibrary.itemType, type as any),
						),
					)
					.limit(1);

				if (existing) {
					await db.delete(userLibrary).where(eq(userLibrary.id, existing.id));
					return { success: true, active: false };
				} else {
					await db.insert(userLibrary).values({
						userId: user.id,
						itemId: id,
						itemType: type as any,
					});
					return { success: true, active: true };
				}
			}

			case "toggle_pin": {
				const [existing] = await db
					.select()
					.from(userLibrary)
					.where(
						and(
							eq(userLibrary.userId, user.id),
							eq(userLibrary.itemId, id),
							eq(userLibrary.itemType, type as any),
						),
					)
					.limit(1);

				if (existing) {
					await db
						.update(userLibrary)
						.set({ isPinned: !existing.isPinned })
						.where(eq(userLibrary.id, existing.id));
					return { success: true, active: !existing.isPinned };
				} else {
					// Auto-add to library and pin
					await db.insert(userLibrary).values({
						userId: user.id,
						itemId: id,
						itemType: type as any,
						isPinned: true,
					});
					return { success: true, active: true };
				}
			}

			case "toggle_block": {
				const blockType = target || type;
				const [existing] = await db
					.select()
					.from(blockedItems)
					.where(
						and(
							eq(blockedItems.userId, user.id),
							eq(blockedItems.itemId, id),
							eq(blockedItems.itemType, blockType as any),
						),
					)
					.limit(1);

				if (existing) {
					await db.delete(blockedItems).where(eq(blockedItems.id, existing.id));
					return { success: true, active: false };
				} else {
					await db.insert(blockedItems).values({
						userId: user.id,
						itemId: id,
						itemType: blockType as any,
					});
					return { success: true, active: true };
				}
			}

			// Playback actions (handled by frontend, but signaled by backend)
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
