import { FastifyPluginAsync } from "fastify";
import z from "zod";
import { getDb } from "../db/helpers.js";
import crypto from "crypto";

const DEV_USER_ID = "dev-user-001";

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
	const db = getDb();

	// ── Library Endpoints ──────────────────────────────────────────────────
	app.get("/library", async () => {
		const items = db
			.prepare("SELECT * FROM user_library WHERE user_id = ?")
			.all(DEV_USER_ID);
		return { library: items };
	});

	app.post("/library", async (request) => {
		const { itemType, itemId } = LibraryItemSchema.parse(request.body);

		db.prepare(
			"INSERT OR IGNORE INTO user_library (user_id, item_type, item_id) VALUES (?, ?, ?)",
		).run(DEV_USER_ID, itemType, itemId);

		return { success: true };
	});

	app.delete("/library", async (request) => {
		const { itemType, itemId } = LibraryItemSchema.parse(request.body);
		db.prepare(
			"DELETE FROM user_library WHERE user_id = ? AND item_type = ? AND item_id = ?",
		).run(DEV_USER_ID, itemType, itemId);
		return { success: true };
	});

	// ── Playlists Endpoints ────────────────────────────────────────────────
	app.get("/playlists", async () => {
		const playlists = db
			.prepare("SELECT * FROM playlists WHERE user_id = ?")
			.all(DEV_USER_ID);
		return { playlists };
	});

	app.post("/playlists", async (request) => {
		const { title, description } = CreatePlaylistSchema.parse(request.body);
		const newId = crypto.randomUUID();

		db.prepare(
			"INSERT INTO playlists (id, user_id, title, description) VALUES (?, ?, ?, ?)",
		).run(newId, DEV_USER_ID, title, description || null);

		return { id: newId, success: true };
	});

	app.delete("/playlists/:id", async (request, reply) => {
		const { id } = request.params as { id: string };
		db.prepare("DELETE FROM playlists WHERE id = ? AND user_id = ?").run(
			id,
			DEV_USER_ID,
		);
		return { success: true };
	});

	// ── Playlist Tracks Endpoints ──────────────────────────────────────────
	app.get("/playlists/:id/tracks", async (request) => {
		const { id } = request.params as { id: string };
		const tracks = db
			.prepare(
				"SELECT * FROM playlist_tracks WHERE playlist_id = ? ORDER BY position",
			)
			.all(id);
		return { tracks };
	});

	app.post("/playlists/:id/tracks", async (request, reply) => {
		const { id } = request.params as { id: string };
		const { trackId } = AddToPlaylistSchema.parse(request.body);

		const playlist = db
			.prepare("SELECT id FROM playlists WHERE id = ? AND user_id = ? LIMIT 1")
			.get(id, DEV_USER_ID);
		if (!playlist)
			return reply
				.status(404)
				.send({ error: "Playlist not found or unauthorized" });

		const maxRow = db
			.prepare(
				"SELECT MAX(position) as max_pos FROM playlist_tracks WHERE playlist_id = ?",
			)
			.get(id) as { max_pos: number | null } | undefined;
		const maxPos = maxRow?.max_pos ?? 0;

		db.prepare(
			"INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)",
		).run(id, trackId, maxPos + 1);
		return { success: true };
	});

	app.delete("/playlists/:id/tracks/:trackId", async (request, reply) => {
		const { id, trackId } = request.params as { id: string; trackId: string };

		const playlist = db
			.prepare("SELECT id FROM playlists WHERE id = ? AND user_id = ? LIMIT 1")
			.get(id, DEV_USER_ID);
		if (!playlist)
			return reply
				.status(404)
				.send({ error: "Playlist not found or unauthorized" });

		db.prepare(
			"DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?",
		).run(id, trackId);
		return { success: true };
	});
};
