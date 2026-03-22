import { FastifyPluginAsync } from "fastify";
import z from "zod";
import { db } from "../db/client.js";
import { userLibrary, playlists, playlistTracks } from "../db/schema.js";
import { and, eq } from "drizzle-orm";
import crypto from "crypto";

const LibraryItemSchema = z.object({
	itemType: z.enum([
		"track",
		"liked_track",
		"library_track",
		"album",
		"artist",
		"playlist",
	]),
	itemId: z.string(),
});

const CreatePlaylistSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
});

const AddToPlaylistSchema = z.object({
	trackId: z.string(),
});

export const libraryRoutes: FastifyPluginAsync = async (app) => {
	// Add user's context assuming a single default user or passing it in
	// As there is no authentication, we'll use a hardcoded dev user
	const DEV_USER_ID = "dev-user-001";

	// ── Library Endpoints ──────────────────────────────────────────────────
	app.get("/library", async (request, reply) => {
		const libraryItems = await db
			.select()
			.from(userLibrary)
			.where(eq(userLibrary.userId, DEV_USER_ID));
		return { library: libraryItems };
	});

	app.post("/library", async (request, reply) => {
		const { itemType, itemId } = LibraryItemSchema.parse(request.body);

		// UPSERT strategy: check if exists, if not insert
		const existing = await db
			.select()
			.from(userLibrary)
			.where(
				and(
					eq(userLibrary.userId, DEV_USER_ID),
					eq(userLibrary.itemType, itemType),
					eq(userLibrary.itemId, itemId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			await db.insert(userLibrary).values({
				userId: DEV_USER_ID,
				itemType,
				itemId,
			});
		}

		return { success: true };
	});

	app.delete("/library", async (request, reply) => {
		const { itemType, itemId } = LibraryItemSchema.parse(request.body);
		await db
			.delete(userLibrary)
			.where(
				and(
					eq(userLibrary.userId, DEV_USER_ID),
					eq(userLibrary.itemType, itemType),
					eq(userLibrary.itemId, itemId),
				),
			);
		return { success: true };
	});

	// ── Playlists Endpoints ────────────────────────────────────────────────
	app.get("/playlists", async (request, reply) => {
		const userPlaylists = await db
			.select()
			.from(playlists)
			.where(eq(playlists.userId, DEV_USER_ID));
		return { playlists: userPlaylists };
	});

	app.post("/playlists", async (request, reply) => {
		const { title, description } = CreatePlaylistSchema.parse(request.body);
		const newId = crypto.randomUUID();

		await db.insert(playlists).values({
			id: newId,
			userId: DEV_USER_ID,
			title,
			description,
		});

		return { id: newId, success: true };
	});

	app.delete("/playlists/:id", async (request, reply) => {
		const { id } = request.params as { id: string };
		await db
			.delete(playlists)
			.where(and(eq(playlists.id, id), eq(playlists.userId, DEV_USER_ID)));
		return { success: true };
	});

	// ── Playlist Tracks Endpoints ──────────────────────────────────────────
	app.get("/playlists/:id/tracks", async (request, reply) => {
		const { id } = request.params as { id: string };
		const tracks = await db
			.select()
			.from(playlistTracks)
			.where(eq(playlistTracks.playlistId, id))
			.orderBy(playlistTracks.position);
		return { tracks };
	});

	app.post("/playlists/:id/tracks", async (request, reply) => {
		const { id } = request.params as { id: string };
		const { trackId } = AddToPlaylistSchema.parse(request.body);

		// check if playlist exists and belongs to user
		const playlist = await db
			.select()
			.from(playlists)
			.where(and(eq(playlists.id, id), eq(playlists.userId, DEV_USER_ID)))
			.limit(1);
		if (playlist.length === 0)
			return reply
				.status(404)
				.send({ error: "Playlist not found or unauthorized" });

		// find max position
		const existingTracks = await db
			.select()
			.from(playlistTracks)
			.where(eq(playlistTracks.playlistId, id));
		const maxPos = existingTracks.reduce(
			(max, t) => Math.max(max, t.position),
			0,
		);

		await db.insert(playlistTracks).values({
			playlistId: id,
			trackId,
			position: maxPos + 1,
		});
		return { success: true };
	});

	app.delete("/playlists/:id/tracks/:trackId", async (request, reply) => {
		const { id, trackId } = request.params as { id: string; trackId: string };

		// check if playlist exists and belongs to user
		const playlist = await db
			.select()
			.from(playlists)
			.where(and(eq(playlists.id, id), eq(playlists.userId, DEV_USER_ID)))
			.limit(1);
		if (playlist.length === 0)
			return reply
				.status(404)
				.send({ error: "Playlist not found or unauthorized" });

		await db
			.delete(playlistTracks)
			.where(
				and(
					eq(playlistTracks.playlistId, id),
					eq(playlistTracks.trackId, trackId),
				),
			);
		return { success: true };
	});
};
