import { getDb, toJson } from "../../db/helpers.js";
import { spotifyClient } from "../../services/spotifyClient.js";
import { lastfmClient } from "../../services/lastfmClient.js";
import { musicbrainzClient } from "../../services/musicbrainzClient.js";
import { embeddingClient } from "../../services/embeddingClient.js";
import { invalidateTrack } from "../../cache/index.js";

export async function handleEnrichTrack(payload: unknown) {
	const { trackId } = payload as { trackId: string };
	const db = getDb();

	const track = db
		.prepare("SELECT * FROM tracks WHERE id = ? LIMIT 1")
		.get(trackId) as any;

	if (!track) throw new Error(`Track not found: ${trackId}`);

	// Mark processing
	db.prepare(
		"UPDATE track_features SET enrichment_status = 'processing', error_message = NULL WHERE track_id = ?",
	).run(trackId);

	const artistName = track.artist_name ?? "";

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

	db.prepare(
		`INSERT INTO track_features (track_id, enrichment_status, enriched_at, error_message, energy, valence, danceability, acousticness, instrumentalness, loudness, speechiness, liveness, spotify_tempo, spotify_id, musicbrainz_id, genre, sub_genre, mood_tags, lastfm_play_count, embedding, embedding_model)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(track_id) DO UPDATE SET
			enrichment_status = excluded.enrichment_status,
			enriched_at = excluded.enriched_at,
			error_message = excluded.error_message,
			energy = excluded.energy,
			valence = excluded.valence,
			danceability = excluded.danceability,
			acousticness = excluded.acousticness,
			instrumentalness = excluded.instrumentalness,
			loudness = excluded.loudness,
			speechiness = excluded.speechiness,
			liveness = excluded.liveness,
			spotify_tempo = excluded.spotify_tempo,
			spotify_id = excluded.spotify_id,
			musicbrainz_id = excluded.musicbrainz_id,
			genre = excluded.genre,
			sub_genre = excluded.sub_genre,
			mood_tags = excluded.mood_tags,
			lastfm_play_count = excluded.lastfm_play_count,
			embedding = excluded.embedding,
			embedding_model = excluded.embedding_model`,
	).run(
		trackId,
		"done",
		nowUnix,
		null,
		sp?.energy ?? null,
		sp?.valence ?? null,
		sp?.danceability ?? null,
		sp?.acousticness ?? null,
		sp?.instrumentalness ?? null,
		sp?.loudness ?? null,
		sp?.speechiness ?? null,
		sp?.liveness ?? null,
		sp?.tempo ?? track.bpm ?? null,
		sp?.spotifyId ?? null,
		mbData.mbid,
		genre,
		mbData.subGenre,
		toJson(lf.tags ?? []),
		lf.playCount,
		toJson(embedding),
		"all-MiniLM-L6-v2",
	);

	// ── Update FAISS index ─────────────────────────────────────────────────────
	if (embedding.length) {
		await embeddingClient.upsert(trackId, embedding).catch(console.warn);
	}

	invalidateTrack(trackId);
}
