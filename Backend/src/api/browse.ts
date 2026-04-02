import { FastifyInstance } from "fastify";
import { getDb, fromJson } from "../db/helpers.js";
import { hifiClient } from "../services/hifiClient.js";

export async function browseRoutes(app: FastifyInstance) {
	const DEV_USER_ID = "dev-user-001";

	app.get("/browse/search-sections", async () => {
		const genres = [
			"Pop",
			"Hip-Hop",
			"Rock",
			"Electronic",
			"R&B",
			"Jazz",
			"Classical",
			"Indie",
			"Metal",
			"Country",
			"Lo-Fi",
			"Study",
			"Workout",
		];

		return {
			categories: [
				{
					title: "For You",
					items: ["Made For You", "New Releases", "Charts", "Trending"],
				},
				{ title: "Genres & Moods", items: genres },
			],
		};
	});

	app.get("/browse/recent-searches", async () => {
		const db = getDb();
		try {
			const history = db
				.prepare(
					"SELECT * FROM search_history WHERE user_id = ? ORDER BY searched_at DESC LIMIT 10",
				)
				.all(DEV_USER_ID) as any[];

			if (history.length > 0) {
				return {
					items: history.map((h) => {
						const meta = fromJson(h.metadata, {} as any);
						return {
							title: h.query || meta?.title || "Unknown",
							type: h.item_type,
							tidalId: h.item_id ? parseInt(h.item_id, 10) : undefined,
							imageUrl: h.image_url,
							...meta,
						};
					}),
				};
			}
		} catch {
			// Fall through to empty result
		}

		return { items: [] };
	});

	app.post<{
		Body: {
			query?: string;
			itemType?: string;
			itemId?: string;
			imageUrl?: string;
			metadata?: any;
		};
	}>("/browse/searches", async (req) => {
		const { query, itemType, itemId, imageUrl, metadata } = req.body;
		const db = getDb();

		db.prepare(
			"INSERT INTO search_history (user_id, query, item_type, item_id, image_url, metadata, searched_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		).run(
			DEV_USER_ID,
			query || null,
			itemType || null,
			itemId || null,
			imageUrl || null,
			metadata ? JSON.stringify(metadata) : null,
			Math.floor(Date.now() / 1000),
		);

		return { success: true };
	});

	// ── Home page aggregation endpoint ─────────────────────────────────────
	app.get("/browse/home", async () => {
		try {
			const [trackRes, albumRes, artistRes] = await Promise.allSettled([
				hifiClient.searchTracks("trending", 10),
				hifiClient.searchAlbums("new releases", 10),
				hifiClient.searchArtists("popular", 8),
			]);

			const trending =
				trackRes.status === "fulfilled" ? trackRes.value.items : [];
			const albums =
				albumRes.status === "fulfilled" ? albumRes.value.items : [];
			const artists =
				artistRes.status === "fulfilled"
					? (artistRes.value.artists?.items ?? [])
					: [];

			return {
				shelves: [
					{
						title: "Trending Tracks",
						type: "tracks",
						items: trending.map((t) => ({
							id: t.id,
							title: t.album?.title ?? t.title,
							artist: t.artist?.name ?? t.artists?.[0]?.name,
							tidalId: t.album?.id ?? t.id,
							imageUrl: hifiClient.tidalImageUrl(t.album?.cover),
							type: "album",
						})),
					},
					{
						title: "Popular Artists",
						type: "artists",
						items: artists.map((a) => ({
							id: a.id,
							title: a.name,
							tidalId: a.id,
							imageUrl: hifiClient.tidalImageUrl(a.picture),
							type: "artist",
						})),
					},
					{
						title: "New Albums",
						type: "albums",
						items: albums.map((al: any) => ({
							id: al.id,
							title: al.title,
							artist: al.artist?.name ?? al.artists?.[0]?.name,
							tidalId: al.id,
							imageUrl: hifiClient.tidalImageUrl(al.cover),
							type: "album",
							songs: al.numberOfTracks,
						})),
					},
				],
			};
		} catch {
			return { shelves: [] };
		}
	});
}
