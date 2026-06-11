import { prisma } from "../../db/prisma.js";
import { toJson } from "../../db/helpers.js";
import { lastfmClient } from "../../services/lastfmClient.js";
import { musicbrainzClient } from "../../services/musicbrainzClient.js";

export async function handleEnrichTrack(payload: unknown) {
	const { trackId } = payload as { trackId: string };

	const track = await prisma.track.findUnique({
		where: { id: trackId },
		include: { artist: true },
	});
	if (!track) throw new Error(`Track not found: ${trackId}`);

	const artistName = track.artist?.name ?? "";

	// Mark processing (create the features row if it doesn't exist yet).
	await prisma.trackFeatures.upsert({
		where: { trackId },
		create: { trackId, enrichmentStatus: "processing" },
		update: { enrichmentStatus: "processing", errorMessage: null },
	});

	// ── Parallel external metadata calls (Last.fm tags + MusicBrainz genre) ──────
	const [lastfm, mb] = await Promise.allSettled([
		lastfmClient.enrich(artistName, track.title),
		musicbrainzClient.enrich(track.title, artistName),
	]);

	const lf =
		lastfm.status === "fulfilled"
			? lastfm.value
			: { tags: [] as string[], playCount: null as number | null };
	const mbData =
		mb.status === "fulfilled"
			? mb.value
			: { mbid: null, genre: null, subGenre: null };

	const genre = mbData.genre ?? lf.tags?.[0] ?? null;

	await prisma.trackFeatures.update({
		where: { trackId },
		data: {
			enrichmentStatus: "done",
			enrichedAt: Math.floor(Date.now() / 1000),
			errorMessage: null,
			musicbrainzId: mbData.mbid,
			genre,
			subGenre: mbData.subGenre,
			moodTags: toJson(lf.tags ?? []),
			lastfmPlayCount: lf.playCount,
		},
	});
}
