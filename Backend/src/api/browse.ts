import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { fromJson, toJson } from "../db/helpers.js";
import { buildDynamicSearchSections } from "../services/homepageBuilder.js";
import { getHomepageShelves } from "../services/homepageCache.js";

const SearchBody = z.object({
	query: z.string().max(500).optional(),
	itemType: z.string().max(50).optional(),
	itemId: z.string().max(200).optional(),
	imageUrl: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
});

export async function browseRoutes(app: FastifyInstance) {
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

	app.get("/browse/recent-searches", async (req) => {
		try {
			const history = await prisma.searchHistory.findMany({
				where: { userId: req.authUserId },
				orderBy: { searchedAt: "desc" },
				take: 10,
			});

			if (history.length > 0) {
				return {
					items: history.map((h) => {
						const meta = fromJson<Record<string, any>>(h.metadata, {});
						return {
							title: h.query || meta?.title || "Unknown",
							type: h.itemType,
							tidalId: h.itemId ? parseInt(h.itemId, 10) : undefined,
							imageUrl: h.imageUrl,
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

	app.post("/browse/searches", async (req) => {
		const { query, itemType, itemId, imageUrl, metadata } = SearchBody.parse(
			req.body,
		);

		// Drop any prior identical entry so the same item/query doesn't pile up
		// duplicate rows; a row keyed by itemId is the same item, otherwise we
		// match on the raw query text.
		await prisma.searchHistory.deleteMany({
			where: {
				userId: req.authUserId,
				...(itemId ? { itemId } : { itemId: null, query: query || null }),
			},
		});

		await prisma.searchHistory.create({
			data: {
				userId: req.authUserId,
				query: query || null,
				itemType: itemType || null,
				itemId: itemId || null,
				imageUrl: imageUrl || null,
				metadata: metadata ? toJson(metadata) : null,
				searchedAt: Math.floor(Date.now() / 1000),
			},
		});

		return { success: true };
	});

	// ── Home page aggregation endpoint ─────────────────────────────────────
	app.get("/browse/home", async (req, reply) => {
		reply.header(
			"Cache-Control",
			"public, max-age=30, stale-while-revalidate=120",
		);
		try {
			const homepage = await getHomepageShelves(req.authUserId);
			return { shelves: homepage.shelves };
		} catch (error) {
			req.log.error({ error }, "browse/home failed unexpectedly");
			return { shelves: [] };
		}
	});
}
