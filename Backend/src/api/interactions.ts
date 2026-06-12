import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { resolveUser, ensureUser } from "../db/repositories/users.js";
import { toJson } from "../db/helpers.js";
import { upsertHifiTrack } from "../db/repositories/catalog.js";
import { hifiClient } from "../services/hifiClient.js";
import {
	scheduleProfileUpdate,
	scheduleEnrichTrack,
} from "../workers/runner.js";

const HIGH_SIGNAL = new Set([
	"like",
	"save",
	"playlist_add",
	"repeat",
	"follow",
]);

const InteractionBody = z.object({
	trackId: z.string().optional(),
	artistId: z.string().optional(),
	albumId: z.string().optional(),
	eventType: z.enum([
		"play",
		"skip",
		"like",
		"unlike",
		"save",
		"unsave",
		"follow",
		"playlist_add",
		"repeat",
	]),
	playDurationSec: z.number().int().optional(),
	trackDurationSec: z.number().int().optional(),
	sessionId: z.string().optional(),
	context: z.record(z.unknown()).optional(),
	occurredAt: z.number().int().optional(),
});

export async function interactionsRoutes(app: FastifyInstance) {
	app.post<{
		Params: { userId: string };
		Body: z.infer<typeof InteractionBody>;
	}>("/users/:userId/interactions", async (req, reply) => {
		const body = InteractionBody.parse(req.body);
		const externalId = req.params.userId;

		// Resolve or auto-create user
		let user = await resolveUser(externalId);
		if (!user) user = await ensureUser(externalId, externalId, 1);

		// Ensure the track exists in our catalog. Tracks played straight from
		// Tidal often aren't ingested yet, so fetch + persist on a miss (which
		// also creates the track's artist and album). This keeps the FK valid and
		// gives top-tracks/top-artists real metadata to display. If we can't
		// resolve it, record the interaction without the track link rather than
		// rejecting it.
		let trackId = body.trackId || null;
		if (trackId) {
			const exists = await prisma.track.findUnique({
				where: { id: trackId },
				select: { id: true },
			});
			if (!exists) {
				try {
					const fetched = (await hifiClient.getTracks([trackId]))[0];
					if (fetched) {
						await upsertHifiTrack(fetched);
						scheduleEnrichTrack(String(fetched.id));
					}
				} catch {
					// hifi-api unreachable / unknown id — fall through to null below.
				}
				const recheck = await prisma.track.findUnique({
					where: { id: trackId },
					select: { id: true },
				});
				if (!recheck) trackId = null;
			}
		}

		// Only attach artist/album foreign keys that actually exist (the track
		// ingest above creates them when known) to avoid FK violations.
		let artistId = body.artistId || null;
		if (artistId) {
			const a = await prisma.artist.findUnique({
				where: { id: artistId },
				select: { id: true },
			});
			if (!a) artistId = null;
		}
		let albumId = body.albumId || null;
		if (albumId) {
			const al = await prisma.album.findUnique({
				where: { id: albumId },
				select: { id: true },
			});
			if (!al) albumId = null;
		}

		const completionRatio =
			body.eventType === "play" && body.playDurationSec && body.trackDurationSec
				? body.playDurationSec / body.trackDurationSec
				: null;

		const nowUnix = Math.floor(Date.now() / 1000);
		const created = await prisma.userInteraction.create({
			data: {
				userId: user.id,
				trackId,
				artistId,
				albumId,
				eventType: body.eventType,
				playDurationSec: body.playDurationSec ?? null,
				trackDurationSec: body.trackDurationSec ?? null,
				completionRatio,
				sessionId: body.sessionId || null,
				context: body.context ? toJson(body.context) : null,
				occurredAt: body.occurredAt ?? nowUnix,
			},
			select: { id: true },
		});

		if (user.isNew) {
			await prisma.user.update({
				where: { id: user.id },
				data: { isNew: 0 },
			});
		}

		if (HIGH_SIGNAL.has(body.eventType)) {
			scheduleProfileUpdate(user.id);
		}

		return reply.status(201).send({
			id: created.id,
			userId: user.id,
			eventType: body.eventType,
		});
	});
}
