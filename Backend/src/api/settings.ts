import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getSettings, saveSettings } from "../db/repositories/settings.js";

const SettingsPatchSchema = z.object({
	streamingQuality: z.string().min(1).max(40).optional(),
	downloadQuality: z.string().min(1).max(40).optional(),
	dataSaver: z.boolean().optional(),
	gaplessPlayback: z.boolean().optional(),
	automix: z.boolean().optional(),
	allowExplicit: z.boolean().optional(),
});

export const settingsRoutes: FastifyPluginAsync = async (app) => {
	app.get("/settings", async (request, reply) => {
		if (!request.authUserId) {
			return reply.status(401).send({ error: "Not authenticated" });
		}
		return { settings: await getSettings(request.authUserId) };
	});

	app.put("/settings", async (request, reply) => {
		if (!request.authUserId) {
			return reply.status(401).send({ error: "Not authenticated" });
		}
		const patch = SettingsPatchSchema.parse(request.body);
		return { settings: await saveSettings(request.authUserId, patch) };
	});
};
