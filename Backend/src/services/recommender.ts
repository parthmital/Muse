import { getDb, fromJson, toJson } from "../db/helpers.js";
import {
	featureCache,
	recCache,
	recCacheKey,
	type RecommendedTrack,
	type CachedFeatures,
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
