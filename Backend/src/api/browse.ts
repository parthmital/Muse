import { FastifyInstance } from "fastify";
import { getDb, fromJson } from "../db/helpers.js";
import {
	buildDynamicSearchSections,
	buildHomepageShelvesForExternalUser,
} from "../services/homepageBuilder.js";

export async function browseRoutes(app: FastifyInstance) {
	const DEV_USER_ID = "dev-user-001";

	app.get("/browse/search-sections", async () => {
		return buildDynamicSearchSections();
	});

	app.get("/browse/search-sections/debug", async () => {
		const sections = await buildDynamicSearchSections();
		const expectedHeadings = [
			"Discover",
			"Genres",
			"Mood & Activity",
			"Themes & Collections",
		];

		const byTitle = new Map(
			(sections.categories ?? []).map((section) => [section.title, section]),
		);

		const sectionChecks = expectedHeadings.map((title) => {
			const section = byTitle.get(title);
			const itemCount = section?.items?.length ?? 0;
			return {
				title,
				headingPresent: !!section,
				itemCount,
				exactly10Ok: itemCount === 10,
			};
		});

		return {
			sectionChecks,
			allExpectedHeadingsPresent: sectionChecks.every((s) => s.headingPresent),
			allSectionsHaveExactly10: sectionChecks.every((s) => s.exactly10Ok),
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
	app.get("/browse/home", async (req, reply) => {
		reply.header(
			"Cache-Control",
			"public, max-age=30, stale-while-revalidate=120",
		);
		try {
			const homepage = await buildHomepageShelvesForExternalUser(DEV_USER_ID);
			return { shelves: homepage.shelves };
		} catch (error) {
			req.log.error({ error }, "browse/home failed unexpectedly");
			return { shelves: [] };
		}
	});
}
