import { FastifyInstance } from "fastify";
import { lastfmClient } from "../services/lastfmClient.js";
import { hifiClient } from "../services/hifiClient.js";

// Helper to format tags: normalize casing and remove artist name
function formatTags(tags: string[], artistName: string): string[] {
	const artistNameLower = artistName.toLowerCase();
	const seen = new Set<string>();
	const formatted: string[] = [];

	for (const tag of tags) {
		const normalized = tag.trim();
		if (!normalized) continue;

		// Skip if tag is just the artist name
		if (normalized.toLowerCase() === artistNameLower) continue;
		if (normalized.toLowerCase().includes(artistNameLower)) continue;

		// Format tag: capitalize first letter of each word, normalize separators
		const formattedTag = normalized
			.split(/[-\s]+/)
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(" ");

		// Skip duplicates (case-insensitive)
		const key = formattedTag.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);

		formatted.push(formattedTag);
	}

	return formatted;
}

export async function lastfmRoutes(app: FastifyInstance) {
	// ── Artist Info ───────────────────────────────────────────────────────────
	app.get<{
		Params: { artistName: string };
	}>("/lastfm/artist/:artistName", async (req, reply) => {
		const { artistName } = req.params;

		try {
			// Fetch artist info from Last.fm
			const artistInfo = await lastfmClient.getArtistInfo(artistName, 10);
			if (!artistInfo) {
				return reply.status(404).send({ error: "Artist not found" });
			}

			// Filter and validate similar artists - only include if they exist on Tidal
			const similarArtistsFiltered = await Promise.all(
				artistInfo.similar.map(async (similarArtist) => {
					try {
						// Search for this artist on Tidal
						const searchResult = await hifiClient.searchArtists(
							similarArtist.name,
							1,
							0,
						);
						const tidalArtist = searchResult.artists?.items?.[0];

						// Only include if artist exists on Tidal
						if (!tidalArtist?.id) {
							return null;
						}

						return {
							name: similarArtist.name,
							url: similarArtist.url,
							image: tidalArtist?.picture
								? hifiClient.tidalImageUrl(tidalArtist.picture)
								: null,
						};
					} catch {
						// Skip if Tidal search fails
						return null;
					}
				}),
			);

			// Filter out null results
			const validSimilarArtists = similarArtistsFiltered.filter(
				(a): a is { name: string; url: string; image: string | null } =>
					a !== null,
			);

			// Format tags: normalize casing and remove artist name
			const formattedTags = formatTags(artistInfo.tags, artistInfo.name);

			return {
				name: artistInfo.name,
				mbid: artistInfo.mbid,
				listeners: artistInfo.listeners,
				playcount: artistInfo.playcount,
				bio: artistInfo.bio,
				similar: validSimilarArtists,
				tags: formattedTags,
			};
		} catch (error: any) {
			app.log.error(
				{ error, artistName },
				"Failed to fetch Last.fm artist info",
			);
			return reply.status(502).send({ error: "Failed to fetch artist info" });
		}
	});

	// ── Tag Info ──────────────────────────────────────────────────────────────
	app.get<{
		Params: { tagName: string };
	}>("/lastfm/tag/:tagName", async (req, reply) => {
		const { tagName } = req.params;

		try {
			const tagInfo = await lastfmClient.getTagInfo(tagName);
			if (!tagInfo) {
				return reply.status(404).send({ error: "Tag not found" });
			}
			return tagInfo;
		} catch (error: any) {
			app.log.error({ error, tagName }, "Failed to fetch Last.fm tag info");
			return reply.status(502).send({ error: "Failed to fetch tag info" });
		}
	});

	// ── Similar Tags ───────────────────────────────────────────────────────────
	app.get<{
		Params: { tagName: string };
		Querystring: { limit?: string };
	}>("/lastfm/tag/:tagName/similar", async (req, reply) => {
		const { tagName } = req.params;
		const limit = parseInt(req.query.limit ?? "20", 10);

		try {
			const similarTags = await lastfmClient.getSimilarTags(tagName, limit);
			return { similar: similarTags };
		} catch (error: any) {
			app.log.error({ error, tagName }, "Failed to fetch similar tags");
			return reply.status(502).send({ error: "Failed to fetch similar tags" });
		}
	});
}
