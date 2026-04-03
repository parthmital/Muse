import { getDb, fromJson, toJson } from "../db/helpers.js";
import {
	featureCache,
	recCache,
	recCacheKey,
	type RecommendedTrack,
	type CachedFeatures,
	type RecommendedArtist,
	type RecommendedAlbum,
	type RecommendedMix,
} from "../cache/index.js";
import { embeddingClient } from "./embeddingClient.js";
import { getProfile } from "./profileBuilder.js";
import { config } from "../config.js";

// ── Surface limits ─────────────────────────────────────────────────────────────
function surfaceLimit(surface: string, override?: number): number {
	if (override) return override;
	return (
		{
			queue: config.queueSize,
			home: config.homeRecCount,
			discover: config.mixTrackCount,
			daily_mix: config.mixTrackCount,
			radio: config.queueSize,
		}[surface] ?? 20
	);
}

// ── Main entry ─────────────────────────────────────────────────────────────────
export async function recommend(opts: {
	userId: string;
	surface: string;
	seedTrackId?: string | null;
	limit?: number;
	excludeIds?: string[];
}): Promise<RecommendedTrack[]> {
	const { userId, surface, seedTrackId, excludeIds = [] } = opts;
	const limit = surfaceLimit(surface, opts.limit);
	const cacheKey = recCacheKey(userId, surface);
	const cached = recCache.get(cacheKey);
	if (cached) return cached;

	const profile = await getProfile(userId);

	if (!profile?.profileVector?.length) {
		const generic = await genericRecs(limit, excludeIds);
		recCache.set(cacheKey, generic);
		return generic;
	}

	let queryVec = profile.profileVector;

	if (surface === "queue" && seedTrackId) {
		queryVec = await blendWithSeed(queryVec, seedTrackId);
	}

	const recentlyPlayed = await recentlyPlayedIds(userId);
	const allExclude = [...new Set([...excludeIds, ...recentlyPlayed])];

	const candidates = await embeddingClient.search(
		queryVec,
		limit * 5,
		allExclude,
	);
	if (!candidates.length) return [];

	const candidateIds = candidates.map((c) => c.id);
	const faissScores = new Map(candidates.map((c) => [c.id, c.score]));

	const [trackRows, featureRows] = await Promise.all([
		fetchTracks(candidateIds),
		fetchFeatures(candidateIds),
	]);

	const scored = score(
		candidateIds,
		faissScores,
		trackRows,
		featureRows,
		profile,
		recentlyPlayed,
	);

	const selected = mmr(scored, featureRows, limit, config.diversityLambda);

	const result = selected.map(([id, s]) => {
		const t = trackRows.get(id)!;
		return {
			trackId: id,
			title: t.title,
			artistName: t.artistName ?? null,
			albumTitle: t.albumTitle ?? null,
			coverUrl: t.coverUrl ?? null,
			score: +s.toFixed(4),
		} satisfies RecommendedTrack;
	});

	recCache.set(cacheKey, result);
	return result;
}

// ── Generic (new users) ───────────────────────────────────────────────────────
async function genericRecs(
	limit: number,
	excludeIds: string[],
): Promise<RecommendedTrack[]> {
	const db = getDb();

	let rows: any[];
	if (excludeIds.length) {
		const placeholders = excludeIds.map(() => "?").join(",");
		rows = db
			.prepare(
				`SELECT id, title, popularity, artist_id, album_id FROM tracks 
				WHERE id NOT IN (${placeholders}) 
				ORDER BY popularity DESC LIMIT ?`,
			)
			.all(...excludeIds, limit) as any[];
	} else {
		rows = db
			.prepare(
				"SELECT id, title, popularity, artist_id, album_id FROM tracks ORDER BY popularity DESC LIMIT ?",
			)
			.all(limit) as any[];
	}

	return rows.map((t) => ({
		trackId: t.id,
		title: t.title,
		artistName: null,
		albumTitle: null,
		coverUrl: null,
		score: t.popularity ?? 0,
		reason: "Popular right now",
	}));
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────
type TrackRow = {
	id: string;
	title: string;
	popularity: number | null;
	artistName?: string;
	albumTitle?: string;
	coverUrl?: string;
};

async function fetchTracks(ids: string[]): Promise<Map<string, TrackRow>> {
	const db = getDb();
	const placeholders = ids.map(() => "?").join(",");
	const rows = db
		.prepare(
			`SELECT id, title, popularity FROM tracks WHERE id IN (${placeholders})`,
		)
		.all(...ids) as any[];
	return new Map(rows.map((r) => [r.id, r]));
}

async function fetchFeatures(
	ids: string[],
): Promise<Map<string, CachedFeatures>> {
	const result = new Map<string, CachedFeatures>();
	const uncached: string[] = [];

	for (const id of ids) {
		const c = featureCache.get(id);
		if (c) result.set(id, c);
		else uncached.push(id);
	}

	if (uncached.length) {
		const db = getDb();
		const placeholders = uncached.map(() => "?").join(",");
		const rows = db
			.prepare(
				`SELECT * FROM track_features WHERE track_id IN (${placeholders})`,
			)
			.all(...uncached) as any[];

		for (const r of rows) {
			const cf: CachedFeatures = {
				trackId: r.track_id,
				energy: r.energy,
				valence: r.valence,
				danceability: r.danceability,
				acousticness: r.acousticness,
				instrumentalness: r.instrumentalness,
				loudness: r.loudness,
				liveness: r.liveness,
				spotifyTempo: r.spotify_tempo,
				genre: r.genre,
				moodTags: fromJson<string[]>(r.mood_tags, []),
				embedding: fromJson<number[]>(r.embedding, []),
				enrichmentStatus: r.enrichment_status ?? "pending",
			};
			featureCache.set(r.track_id, cf);
			result.set(r.track_id, cf);
		}
	}
	return result;
}

async function recentlyPlayedIds(userId: string): Promise<Set<string>> {
	const db = getDb();
	const cutoffSec = Math.floor(Date.now() / 1000) - 7 * 86400;
	const rows = db
		.prepare(
			"SELECT track_id FROM user_interactions WHERE user_id = ? AND event_type = 'play' AND occurred_at >= ?",
		)
		.all(userId, cutoffSec) as any[];
	return new Set(rows.map((r) => r.track_id).filter(Boolean) as string[]);
}

async function blendWithSeed(
	profileVec: number[],
	seedId: string,
): Promise<number[]> {
	const feat =
		featureCache.get(seedId) ?? (await fetchFeatures([seedId])).get(seedId);
	if (!feat?.embedding?.length) return profileVec;
	const alpha = 0.4;
	const seed = feat.embedding;
	const blended = profileVec.map((v, i) => (1 - alpha) * v + alpha * seed[i]);
	return l2norm(blended);
}

// ── Scoring ───────────────────────────────────────────────────────────────────
function score(
	ids: string[],
	faissScores: Map<string, number>,
	tracks: Map<string, TrackRow>,
	features: Map<string, CachedFeatures>,
	profile: {
		avgEnergy: number | null;
		avgValence: number | null;
		avgDanceability: number | null;
		avgAcousticness: number | null;
	},
	recentlyPlayed: Set<string>,
): [string, number][] {
	return ids
		.filter((id) => tracks.has(id))
		.map((id): [string, number] => {
			const feat = features.get(id);
			const cosine = faissScores.get(id) ?? 0;
			const featureMatch = calcFeatureMatch(feat, profile);
			const pop = logPop(tracks.get(id)!.popularity);
			const novelty = recentlyPlayed.has(id) ? 0 : 1;
			const s =
				0.5 * cosine +
				0.3 * featureMatch +
				config.popularityWeight * pop +
				config.noveltyWeight * novelty;
			return [id, s];
		})
		.sort((a, b) => b[1] - a[1]);
}

function calcFeatureMatch(
	feat: CachedFeatures | undefined,
	profile: {
		avgEnergy: number | null;
		avgValence: number | null;
		avgDanceability: number | null;
		avgAcousticness: number | null;
	},
): number {
	if (!feat) return 0.5;
	const pairs: [number | null, number | null][] = [
		[feat.energy, profile.avgEnergy],
		[feat.valence, profile.avgValence],
		[feat.danceability, profile.avgDanceability],
		[feat.acousticness, profile.avgAcousticness],
	];
	const diffs = pairs
		.filter(([a, b]) => a != null && b != null)
		.map(([a, b]) => Math.abs(a! - b!));
	return diffs.length
		? 1 - diffs.reduce((s, d) => s + d, 0) / diffs.length
		: 0.5;
}

function logPop(p: number | null): number {
	if (!p) return 0;
	return Math.log1p(p) / Math.log1p(100);
}

// ── MMR ───────────────────────────────────────────────────────────────────────
function mmr(
	scored: [string, number][],
	features: Map<string, CachedFeatures>,
	k: number,
	lambda: number,
): [string, number][] {
	const candidates = new Map(scored);
	const selected: [string, number][] = [];
	const selectedVecs: number[][] = [];

	while (candidates.size && selected.length < k) {
		let bestId: string | null = null,
			bestMmr = -Infinity;

		for (const [id, rel] of candidates) {
			const fv = scalarVec(features.get(id));
			const maxSim = selectedVecs.reduce(
				(m, sv) => Math.max(m, cosineSim(fv, sv)),
				0,
			);
			const mmrScore = lambda * rel - (1 - lambda) * maxSim;
			if (mmrScore > bestMmr) {
				bestMmr = mmrScore;
				bestId = id;
			}
		}
		if (!bestId) break;
		selected.push([bestId, candidates.get(bestId)!]);
		selectedVecs.push(scalarVec(features.get(bestId)));
		candidates.delete(bestId);
	}
	return selected;
}

function scalarVec(f: CachedFeatures | undefined): number[] {
	return [
		f?.energy ?? 0.5,
		f?.valence ?? 0.5,
		f?.danceability ?? 0.5,
		f?.acousticness ?? 0.5,
		f?.instrumentalness ?? 0.5,
		f?.liveness ?? 0.5,
	];
}

function cosineSim(a: number[], b: number[]): number {
	let dot = 0,
		na = 0,
		nb = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		na += a[i] ** 2;
		nb += b[i] ** 2;
	}
	return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

function l2norm(v: number[]): number[] {
	const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
	return norm > 0 ? v.map((x) => x / norm) : v;
}

// ── Radio Seeds ───────────────────────────────────────────────────────────────

export async function pickRadioSeeds(userId: string): Promise<string[]> {
	const db = getDb();

	const historyRows = db
		.prepare(
			"SELECT track_id as id FROM user_interactions WHERE user_id = ? AND event_type = 'play' ORDER BY occurred_at DESC LIMIT 100",
		)
		.all(userId) as any[];

	const libraryRows = db
		.prepare(
			"SELECT item_id as id FROM user_library WHERE user_id = ? AND item_type = 'track' LIMIT 100",
		)
		.all(userId) as any[];

	const history = historyRows.map((r) => r.id).filter(Boolean) as string[];
	const library = libraryRows.map((r) => r.id).filter(Boolean) as string[];

	const combined = [...new Set([...history, ...library])];
	for (let i = combined.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[combined[i], combined[j]] = [combined[j], combined[i]];
	}

	return combined.slice(0, 50);
}

// ── Homepage Personalized Sections ───────────────────────────────────────────

export async function getMadeForYou(
	userId: string,
	limit = 10,
): Promise<RecommendedTrack[]> {
	const cacheKey = recCacheKey(userId, "made_for_you");
	const cached = recCache.get(cacheKey);
	if (cached) return cached as RecommendedTrack[];

	const tracks = await recommend({ userId, surface: "made_for_you", limit });
	recCache.set(cacheKey, tracks);
	return tracks;
}

export async function getFavouriteArtists(
	userId: string,
	limit = 8,
): Promise<RecommendedArtist[]> {
	const cacheKey = recCacheKey(userId, "favourite_artists");
	const cached = recCache.get(cacheKey);
	if (cached) return cached as unknown as RecommendedArtist[];

	const db = getDb();

	// Get artists from user interactions (plays, likes, saves) and library
	const artistRows = db
		.prepare(
			`
			SELECT 
				a.id,
				a.name,
				a.picture_url,
				a.genres,
				COUNT(ui.id) as play_count,
				SUM(CASE WHEN ui.event_type IN ('like', 'save', 'follow') THEN 2 
						 WHEN ui.event_type = 'play' THEN 1 
						 WHEN ui.event_type = 'skip' THEN -0.5 
						 ELSE 0 END) as score
			FROM artists a
			LEFT JOIN user_interactions ui ON a.id = ui.artist_id AND ui.user_id = ?
			WHERE ui.user_id = ? OR a.id IN (
				SELECT item_id FROM user_library WHERE user_id = ? AND item_type = 'artist'
			)
			GROUP BY a.id
			ORDER BY score DESC, play_count DESC
			LIMIT ?
		`,
		)
		.all(userId, userId, userId, limit) as any[];

	// If no user data, return popular artists
	let artists: RecommendedArtist[];
	if (artistRows.length === 0) {
		const popularRows = db
			.prepare(
				"SELECT id, name, picture_url, genres FROM artists ORDER BY popularity DESC LIMIT ?",
			)
			.all(limit) as any[];
		artists = popularRows.map((a, i) => ({
			artistId: a.id,
			name: a.name,
			pictureUrl: a.picture_url ?? null,
			genres: a.genres ? fromJson<string[]>(a.genres, []) : [],
			score: (popularRows.length - i) / popularRows.length,
		}));
	} else {
		artists = artistRows.map((a) => ({
			artistId: a.id,
			name: a.name,
			pictureUrl: a.picture_url ?? null,
			genres: a.genres ? fromJson<string[]>(a.genres, []) : [],
			score: Math.max(0, a.score ?? 0),
		}));
	}

	recCache.set(cacheKey, artists as unknown as RecommendedTrack[]);
	return artists;
}

export async function getAlbumsForYou(
	userId: string,
	limit = 10,
): Promise<RecommendedAlbum[]> {
	const cacheKey = recCacheKey(userId, "albums_for_you");
	const cached = recCache.get(cacheKey);
	if (cached) return cached as unknown as RecommendedAlbum[];

	const db = getDb();
	const profile = await getProfile(userId);

	// Get albums based on user's listening history and preferred genres
	let albums: RecommendedAlbum[];

	if (
		profile?.preferredGenres &&
		Object.keys(profile.preferredGenres).length > 0
	) {
		// Get albums from preferred genres
		const topGenres = Object.entries(profile.preferredGenres)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([g]) => g);

		const placeholders = topGenres.map(() => "?").join(",");
		const albumRows = db
			.prepare(
				`
				SELECT DISTINCT 
					al.id, 
					al.title, 
					al.cover_url, 
					al.release_date,
					ar.name as artist_name,
					tf.genre,
					MAX(t.popularity) as album_popularity
				FROM albums al
				JOIN tracks t ON t.album_id = al.id
				JOIN track_features tf ON tf.track_id = t.id
				JOIN artists ar ON ar.id = al.artist_id OR ar.id = t.artist_id
				WHERE tf.genre IN (${placeholders})
				GROUP BY al.id
				ORDER BY album_popularity DESC, al.release_date DESC
				LIMIT ?
			`,
			)
			.all(...topGenres, limit) as any[];

		albums = albumRows.map((a, i) => ({
			albumId: a.id,
			title: a.title,
			artistName: a.artist_name ?? null,
			coverUrl: a.cover_url ?? null,
			releaseDate: a.release_date ?? null,
			score: (albumRows.length - i) / albumRows.length,
		}));
	} else {
		// Fallback to popular albums (using track popularity as proxy)
		const albumRows = db
			.prepare(
				`
				SELECT 
					al.id, 
					al.title, 
					al.cover_url, 
					al.release_date,
					ar.name as artist_name,
					MAX(t.popularity) as album_popularity
				FROM albums al
				JOIN tracks t ON t.album_id = al.id
				LEFT JOIN artists ar ON ar.id = al.artist_id
				GROUP BY al.id
				ORDER BY album_popularity DESC, al.release_date DESC
				LIMIT ?
			`,
			)
			.all(limit) as any[];

		albums = albumRows.map((a, i) => ({
			albumId: a.id,
			title: a.title,
			artistName: a.artist_name ?? null,
			coverUrl: a.cover_url ?? null,
			releaseDate: a.release_date ?? null,
			score: (albumRows.length - i) / albumRows.length,
		}));
	}

	recCache.set(cacheKey, albums as unknown as RecommendedTrack[]);
	return albums;
}

export async function getTopMixes(
	userId: string,
	limit = 6,
): Promise<RecommendedMix[]> {
	const cacheKey = recCacheKey(userId, "top_mixes");
	const cached = recCache.get(cacheKey);
	if (cached) return cached as unknown as RecommendedMix[];

	const db = getDb();

	// Get mix IDs from user's listening history
	const mixRows = db
		.prepare(
			`
			SELECT 
				t.mix_ids,
				COUNT(ui.id) as play_count,
				MAX(ui.occurred_at) as last_played
			FROM user_interactions ui
			JOIN tracks t ON t.id = ui.track_id
			WHERE ui.user_id = ? AND ui.event_type = 'play' AND t.mix_ids IS NOT NULL
			GROUP BY t.mix_ids
			ORDER BY play_count DESC, last_played DESC
			LIMIT 20
		`,
		)
		.all(userId) as any[];

	// Parse mix_ids JSON and aggregate
	const mixScores = new Map<string, number>();
	for (const row of mixRows) {
		if (!row.mix_ids) continue;
		const mixIds = fromJson<string[]>(row.mix_ids, []);
		for (const mixId of mixIds) {
			mixScores.set(mixId, (mixScores.get(mixId) ?? 0) + (row.play_count ?? 1));
		}
	}

	// Convert to sorted array and take top
	const sortedMixes = [...mixScores.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit);

	// Build mix objects (mixes don't have a separate table, so we construct from listening data)
	const mixes: RecommendedMix[] = sortedMixes.map(([mixId, score], i) => ({
		mixId,
		title: `Mix ${mixId.replace(/-/g, " ").replace(/_/g, " ")}`,
		subTitle: "Based on your listening",
		coverUrl: null,
		score: score / (sortedMixes[0]?.[1] ?? 1),
	}));

	// If no mixes from history, return empty (mixes need to come from actual listening)
	recCache.set(cacheKey, mixes as unknown as RecommendedTrack[]);
	return mixes;
}
