import { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { desc, eq } from "drizzle-orm";
import { searchHistory, users } from "../db/schema.js";
import { hifiClient } from "../services/hifiClient.js";

// ── Handlers ─────────────────────────────────────────────────────────────────

export async function browseRoutes(app: FastifyInstance) {
	/**
	 * Returns categories for the search/browse page.
	 * Now derived from a set of canonical genres.
	 */
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
			"workout",
		];

		const categories = [
			{
				title: "For You",
				items: ["Made For You", "New Releases", "Charts", "Trending"],
			},
			{
				title: "Genres & Moods",
				items: genres,
			},
		];

		return { categories };
	});

	/**
	 * Pulls the user's recent search history from the DB.
	 * If empty, fetches some "trending" items dynamically from Tidal.
	 */
	app.get("/browse/recent-searches", async () => {
		try {
			const history = await db
				.select()
				.from(searchHistory)
				.orderBy(desc(searchHistory.searchedAt))
				.limit(10);

			if (history && history.length > 0) {
				return {
					items: history.map((h) => ({
						title: h.query || (h.metadata as any)?.title || "Unknown",
						type: h.itemType,
						tidalId: h.itemId ? parseInt(h.itemId, 10) : undefined,
						imageUrl: h.imageUrl,
						...((h.metadata as any) || {}),
					})),
				};
			}
		} catch (e) {
			// Fail through to discovery
		}

		// Discovery fallback: Search for some "seed" popular content
		try {
			const [popularTracks, popularArtists] = await Promise.all([
				hifiClient.searchTracks("Trending", 4),
				hifiClient.searchArtists("Daft Punk", 2),
			]);

			const items = [
				...popularArtists.artists.items.map((a) => ({
					tidalId: Number(a.id),
					title: a.name,
					type: "artist",
					imageUrl: hifiClient.tidalImageUrl(a.picture),
				})),
				...popularTracks.items.map((t) => ({
					tidalId: Number(t.id),
					title: t.title,
					artist: t.artist?.name,
					type: "track",
					imageUrl: hifiClient.tidalImageUrl(t.imageId),
				})),
			];

			return { items };
		} catch (err) {
			return { items: [] };
		}
	});

	app.post<{
		Body: {
			query?: string;
			itemType?: string;
			itemId?: string;
			imageUrl?: string;
			metadata?: any;
		};
	}>("/browse/searches", async (req, reply) => {
		const { query, itemType, itemId, imageUrl, metadata } = req.body;

		// Link to the primary development user
		const DEV_USER_ID = "dev-user-001";
		let [user] = await db
			.select()
			.from(users)
			.where(eq(users.id, DEV_USER_ID))
			.limit(1);

		if (!user) {
			// Fallback to any user if dev user doesn't exist
			[user] = await db.select().from(users).limit(1);
		}

		if (!user) {
			return reply.status(401).send({ error: "No user found to link history" });
		}

		await db.insert(searchHistory).values({
			userId: user.id,
			query,
			itemType,
			itemId,
			imageUrl,
			metadata: metadata ? JSON.stringify(metadata) : null,
			searchedAt: Math.floor(Date.now() / 1000),
		});

		return { success: true };
	});
}
