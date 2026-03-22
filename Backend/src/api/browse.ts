import { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { eq, desc } from "drizzle-orm";
import { searchHistory, users } from "../db/schema.js";
import { config } from "../config.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function proxiedImage(pictureId: string | null, size = "640x640") {
	if (!pictureId) return "";
	const safeId = pictureId.replace(/\//g, "-");
	return `${config.apiBaseUrl}/tidal/images/${safeId}?size=${size}`;
}

// ── Mock Data for fallback/discovery ─────────────────────────────────────────

const DISCOVERY_ITEMS = [
	{
		tidalId: 5468,
		title: "Daft Punk",
		type: "artist",
		imageUrl: proxiedImage("84de7982/f38b/47bc/ad69/3f044d014f37"),
	},
	{
		tidalId: 457,
		title: "David Bowie",
		type: "artist",
		imageUrl: proxiedImage("992f77d8/f731/844f/9a7f/3e1284e79907"),
	},
	{
		tidalId: 3418512,
		title: "Black Holes and Revelations",
		artist: "Muse",
		songs: 11,
		type: "album",
		imageUrl: proxiedImage("187a71f7/e26b/4e0d/929a/113c36ab3607"),
	},
];

const SEARCH_SECTIONS = [
	{
		title: "Discover",
		items: ["Made For You", "New Releases", "Charts", "Trending"],
	},
	{
		title: "Genres",
		items: ["Pop", "Country", "Hip-Hop", "Rock", "Indie"],
	},
];

// ── Handlers ─────────────────────────────────────────────────────────────────

export async function browseRoutes(app: FastifyInstance) {
	app.get("/browse/search-sections", async () => {
		return { categories: SEARCH_SECTIONS };
	});

	app.get("/browse/recent-searches", async () => {
		try {
			// Pull from DB
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
			// Fallback if table doesn't exist yet
		}

		// Fallback to high-quality featured items (with images)
		return { items: DISCOVERY_ITEMS };
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

		// For demo/simple version, we'll just use a default user or try to find one
		let [user] = await db.select().from(users).limit(1);
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
