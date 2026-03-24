import { getDb, fromJson, toJson } from "../db/helpers.js";
import {
	profileCache,
	invalidateProfile,
	type CachedProfile,
} from "../cache/index.js";
import { config } from "../config.js";

const EVENT_WEIGHT: Record<string, number> = {
	play: 1.0,
	skip: -0.5,
	like: 2.0,
	unlike: -1.0,
	save: 2.0,
	unsave: -1.0,
	follow: 1.5,
	playlist_add: 1.8,
	repeat: 2.5,
};

function completionMult(ratio: number): number {
	if (ratio >= 0.8) return 1.0;
	if (ratio >= 0.5) return 0.7;
	return 0.3;
}

export async function buildProfile(
	userId: string,
): Promise<CachedProfile | null> {
	const db = getDb();

	// Fetch interactions (last 5000)
	const interactions = db
		.prepare(
			"SELECT * FROM user_interactions WHERE user_id = ? ORDER BY occurred_at DESC LIMIT 5000",
		)
		.all(userId) as any[];

	if (!interactions.length) return null;

	const trackIds = [
		...new Set(interactions.map((i) => i.track_id).filter(Boolean) as string[]),
	];

	const placeholders = trackIds.map(() => "?").join(",");
	const features = db
		.prepare(
			`SELECT * FROM track_features WHERE track_id IN (${placeholders}) AND enrichment_status = 'done'`,
		)
		.all(...trackIds) as any[];

	const featMap = new Map(features.map((f) => [f.track_id, f]));

	// Compute per-track weights
	const nowSec = Math.floor(Date.now() / 1000);
	const weightMap = new Map<string, number>();

	for (const i of interactions) {
		if (!i.track_id) continue;
		const base = EVENT_WEIGHT[i.event_type] ?? 0;
		if (base === 0) continue;
		let w = base;
		if (i.event_type === "play" && i.completion_ratio != null) {
			w *= completionMult(i.completion_ratio);
		}
		const daysAgo = (nowSec - (i.occurred_at ?? nowSec)) / 86400;
		const decay = Math.exp(-daysAgo / config.recencyDecayDays);
		weightMap.set(
			i.track_id,
			Math.min(5, Math.max(-3, (weightMap.get(i.track_id) ?? 0) + w * decay)),
		);
	}

	// Aggregate profile vector (weighted mean of embeddings)
	const dim = config.embeddingDim;
	let profileVec: Float64Array | null = null;
	let posWeightSum = 0;

	const scalarAccum = {
		energy: { sum: 0, w: 0 },
		valence: { sum: 0, w: 0 },
		danceability: { sum: 0, w: 0 },
		acousticness: { sum: 0, w: 0 },
	};
	const genreAccum = new Map<string, number>();

	for (const [tid, weight] of weightMap) {
		const feat = featMap.get(tid);
		if (!feat) continue;

		const embedding = fromJson<number[]>(feat.embedding, []);
		if (embedding.length === dim && weight > 0) {
			if (!profileVec) profileVec = new Float64Array(dim);
			posWeightSum += weight;
			for (let i = 0; i < dim; i++) profileVec[i] += embedding[i] * weight;
		}

		const absW = Math.abs(weight);
		for (const key of [
			"energy",
			"valence",
			"danceability",
			"acousticness",
		] as const) {
			const val = feat[key];
			if (val != null) {
				scalarAccum[key].sum += val * absW;
				scalarAccum[key].w += absW;
			}
		}
		if (feat.genre) {
			genreAccum.set(feat.genre, (genreAccum.get(feat.genre) ?? 0) + absW);
		}
	}

	// L2-normalise profile vector
	let profileVectorArr: number[] | null = null;
	if (profileVec && posWeightSum > 0) {
		for (let i = 0; i < dim; i++) profileVec[i] /= posWeightSum;
		const norm = Math.sqrt(
			Array.from(profileVec).reduce((s, v) => s + v * v, 0),
		);
		if (norm > 0) for (let i = 0; i < dim; i++) profileVec[i] /= norm;
		profileVectorArr = Array.from(profileVec);
	}

	const avg = (k: keyof typeof scalarAccum) => {
		const a = scalarAccum[k];
		return a.w > 0 ? a.sum / a.w : null;
	};

	const totalGenreW = [...genreAccum.values()].reduce((s, v) => s + v, 1e-9);
	const preferredGenres = Object.fromEntries(
		[...genreAccum.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 20)
			.map(([g, w]) => [g, +(w / totalGenreW).toFixed(4)]),
	);

	const profile: CachedProfile = {
		userId,
		profileVector: profileVectorArr,
		avgEnergy: avg("energy"),
		avgValence: avg("valence"),
		avgDanceability: avg("danceability"),
		avgAcousticness: avg("acousticness"),
		preferredGenres,
		totalPlayCount: interactions.length,
	};

	// Persist to SQLite (upsert)
	const nowUnix = Math.floor(Date.now() / 1000);
	db.prepare(
		`INSERT INTO user_profiles (user_id, profile_vector, avg_energy, avg_valence, avg_danceability, avg_acousticness, preferred_genres, total_play_count, unique_tracks_played, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			profile_vector = excluded.profile_vector,
			avg_energy = excluded.avg_energy,
			avg_valence = excluded.avg_valence,
			avg_danceability = excluded.avg_danceability,
			avg_acousticness = excluded.avg_acousticness,
			preferred_genres = excluded.preferred_genres,
			total_play_count = excluded.total_play_count,
			unique_tracks_played = excluded.unique_tracks_played,
			updated_at = excluded.updated_at`,
	).run(
		userId,
		toJson(profileVectorArr),
		profile.avgEnergy,
		profile.avgValence,
		profile.avgDanceability,
		profile.avgAcousticness,
		toJson(preferredGenres),
		interactions.length,
		trackIds.length,
		nowUnix,
	);

	profileCache.set(userId, profile);
	invalidateProfile(userId);
	return profile;
}

export async function getProfile(
	userId: string,
): Promise<CachedProfile | null> {
	const cached = profileCache.get(userId);
	if (cached) return cached;

	const db = getDb();
	const row = db
		.prepare("SELECT * FROM user_profiles WHERE user_id = ? LIMIT 1")
		.get(userId) as any;

	if (!row) return null;

	const profile: CachedProfile = {
		userId,
		profileVector: fromJson<number[]>(row.profile_vector, []),
		avgEnergy: row.avg_energy,
		avgValence: row.avg_valence,
		avgDanceability: row.avg_danceability,
		avgAcousticness: row.avg_acousticness,
		preferredGenres: fromJson<Record<string, number>>(row.preferred_genres, {}),
		totalPlayCount: row.total_play_count ?? 0,
	};
	profileCache.set(userId, profile);
	return profile;
}
