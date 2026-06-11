import { FastifyPluginAsync } from "fastify";
import z from "zod";
import crypto from "node:crypto";
import {
	listLibrary,
	addLibraryItem,
	removeLibraryItem,
} from "../db/repositories/library.js";
import {
	listPlaylists,
	createPlaylist,
	deletePlaylist,
	userOwnsPlaylist,
	listPlaylistTracks,
	addTrackToPlaylist,
	removeTrackFromPlaylist,
} from "../db/repositories/playlists.js";

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
	title: z.string().min(1).max(200),
	description: z.string().max(2000).optional(),
});

const AddToPlaylistSchema = z.object({
	trackId: z.string(),
});

const IdParam = z.object({ id: z.string() });
const IdTrackParam = z.object({ id: z.string(), trackId: z.string() });

export const libraryRoutes: FastifyPluginAsync = async (app) => {
	// ── Library Endpoints ──────────────────────────────────────────────────
	app.get("/library", async (request) => {
		return { library: await listLibrary(request.authUserId) };
	});

	app.post("/library", async (request) => {
		const { itemType, itemId } = LibraryItemSchema.parse(request.body);
		await addLibraryItem(request.authUserId, itemType, itemId);
		return { success: true };
	});

	app.delete("/library", async (request) => {
		const { itemType, itemId } = LibraryItemSchema.parse(request.body);
		await removeLibraryItem(request.authUserId, itemType, itemId);
		return { success: true };
	});

	// ── Playlists Endpoints ────────────────────────────────────────────────
	app.get("/playlists", async (request) => {
		return { playlists: await listPlaylists(request.authUserId) };
	});

	app.post("/playlists", async (request) => {
		const { title, description } = CreatePlaylistSchema.parse(request.body);
		const newId = crypto.randomUUID();
		await createPlaylist(newId, request.authUserId, title, description ?? null);
		return { id: newId, success: true };
	});

	app.delete("/playlists/:id", async (request) => {
		const { id } = IdParam.parse(request.params);
		await deletePlaylist(id, request.authUserId);
		return { success: true };
	});

	// ── Playlist Tracks Endpoints ──────────────────────────────────────────
	app.get("/playlists/:id/tracks", async (request) => {
		const { id } = IdParam.parse(request.params);
		return { tracks: await listPlaylistTracks(id) };
	});

	app.post("/playlists/:id/tracks", async (request, reply) => {
		const { id } = IdParam.parse(request.params);
		const { trackId } = AddToPlaylistSchema.parse(request.body);

		if (!(await userOwnsPlaylist(id, request.authUserId)))
			return reply
				.status(404)
				.send({ error: "Playlist not found or unauthorized" });

		await addTrackToPlaylist(id, trackId);
		return { success: true };
	});

	app.delete("/playlists/:id/tracks/:trackId", async (request, reply) => {
		const { id, trackId } = IdTrackParam.parse(request.params);

		if (!(await userOwnsPlaylist(id, request.authUserId)))
			return reply
				.status(404)
				.send({ error: "Playlist not found or unauthorized" });

		await removeTrackFromPlaylist(id, trackId);
		return { success: true };
	});
};
