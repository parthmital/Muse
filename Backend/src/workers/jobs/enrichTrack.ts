import { eq } from "drizzle-orm";
import { db, toJson } from "../../db/client.js";
import { tracks, trackFeatures } from "../../db/schema.js";
import { spotifyClient } from "../../services/spotifyClient.js";
import { lastfmClient } from "../../services/lastfmClient.js";
import { musicbrainzClient } from "../../services/musicbrainzClient.js";
import { embeddingClient } from "../../services/embeddingClient.js";
import { featureCache, invalidateTrack } from "../../cache/index.js";

export async function handleEnrichTrack(payload: unknown) {
	const { trackId } = payload as { trackId: string };

	const [track] = await db
		.select()
		.from(tracks)
		.where(eq(tracks.id, trackId))
		.limit(1);

	if (!track) throw new Error(`Track not found: ${trackId}`);

	// Mark processing
	await db
		.update(trackFeatures)
		.set({ enrichmentStatus: "processing", errorMessage: null })
		.where(eq(trackFeatures.trackId, trackId));

	// Get artist name from DB
	const artistName = (track as any).artistName ?? "";

	// ── Parallel external calls ────────────────────────────────────────────────
	const [spotify, lastfm, mb] = await Promise.allSettled([
		spotifyClient.enrich(track.title, artistName, track.isrc),
		lastfmClient.enrich(artistName, track.title),
		musicbrainzClient.enrich(track.title, artistName),
	]);

	const sp = spotify.status === "fulfilled" ? spotify.value : null;
	const lf =
		lastfm.status === "fulfilled"
			? lastfm.value
			: { tags: [], playCount: null };
	const mbData =
		mb.status === "fulfilled"
			? mb.value
			: { mbid: null, genre: null, subGenre: null };

	const genre = mbData.genre ?? lf.tags?.[0] ?? null;

	// ── Text embedding ─────────────────────────────────────────────────────────
	const text = embeddingClient.buildText(
		track.title,
		artistName,
		genre,
		lf.tags,
	);
	const embedding = await embeddingClient.embed(text);

	// ── Persist ────────────────────────────────────────────────────────────────
	const nowUnix = Math.floor(Date.now() / 1000);
	const update = {
		enrichmentStatus: "done",
		enrichedAt: nowUnix,
		errorMessage: null,
		// Spotify
		energy: sp?.energy ?? null,
		valence: sp?.valence ?? null,
		danceability: sp?.danceability ?? null,
		acousticness: sp?.acousticness ?? null,
		instrumentalness: sp?.instrumentalness ?? null,
		loudness: sp?.loudness ?? null,
		speechiness: sp?.speechiness ?? null,
		liveness: sp?.liveness ?? null,
		spotifyTempo: sp?.tempo ?? track.bpm ?? null,
		spotifyId: sp?.spotifyId ?? null,
		// MusicBrainz
		musicbrainzId: mbData.mbid,
		genre,
		subGenre: mbData.subGenre,
		// LastFM
		moodTags: toJson(lf.tags ?? []),
		lastfmPlayCount: lf.playCount,
		// Embedding
		embedding: toJson(embedding),
		embeddingModel: "all-MiniLM-L6-v2",
	};

	await db
		.insert(trackFeatures)
		.values({ trackId, ...update })
		.onConflictDoUpdate({ target: trackFeatures.trackId, set: update });

	// ── Update FAISS index ─────────────────────────────────────────────────────
	if (embedding.length) {
		await embeddingClient.upsert(trackId, embedding).catch(console.warn);
	}

	invalidateTrack(trackId);
}
