import { eq, inArray, desc, and, gte } from "drizzle-orm";
import { db, fromJson, toJson } from "../db/client.js";
import { userInteractions, trackFeatures, userProfiles } from "../db/schema.js";
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
	// Fetch interactions (last 5000)
	const interactions = await db
		.select()
		.from(userInteractions)
		.where(eq(userInteractions.userId, userId))
		.orderBy(desc(userInteractions.occurredAt))
		.limit(5000);

	if (!interactions.length) return null;

	const trackIds = [
		...new Set(interactions.map((i) => i.trackId).filter(Boolean) as string[]),
	];

	const features = await db
		.select()
		.from(trackFeatures)
		.where(
			and(
				inArray(trackFeatures.trackId, trackIds),
				eq(trackFeatures.enrichmentStatus, "done"),
			),
		);

	const featMap = new Map(features.map((f) => [f.trackId, f]));

	// Compute per-track weights
	const nowSec = Math.floor(Date.now() / 1000);
	const weightMap = new Map<string, number>();

	for (const i of interactions) {
		if (!i.trackId) continue;
		const base = EVENT_WEIGHT[i.eventType] ?? 0;
		if (base === 0) continue;
		let w = base;
		if (i.eventType === "play" && i.completionRatio != null) {
			w *= completionMult(i.completionRatio);
		}
		const daysAgo = (nowSec - (i.occurredAt ?? nowSec)) / 86400;
		const decay = Math.exp(-daysAgo / config.recencyDecayDays);
		weightMap.set(
			i.trackId,
			Math.min(5, Math.max(-3, (weightMap.get(i.trackId) ?? 0) + w * decay)),
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

	// Persist to SQLite
	const nowUnix = Math.floor(Date.now() / 1000);
	await db
		.insert(userProfiles)
		.values({
			userId,
			profileVector: toJson(profileVectorArr),
			avgEnergy: profile.avgEnergy,
			avgValence: profile.avgValence,
			avgDanceability: profile.avgDanceability,
			avgAcousticness: profile.avgAcousticness,
			preferredGenres: toJson(preferredGenres),
			totalPlayCount: interactions.length,
			uniqueTracksPlayed: trackIds.length,
			updatedAt: nowUnix,
		})
		.onConflictDoUpdate({
			target: userProfiles.userId,
			set: {
				profileVector: toJson(profileVectorArr),
				avgEnergy: profile.avgEnergy,
				avgValence: profile.avgValence,
				avgDanceability: profile.avgDanceability,
				avgAcousticness: profile.avgAcousticness,
				preferredGenres: toJson(preferredGenres),
				totalPlayCount: interactions.length,
				uniqueTracksPlayed: trackIds.length,
				updatedAt: nowUnix,
			},
		});

	profileCache.set(userId, profile);
	invalidateProfile(userId);
	return profile;
}

export async function getProfile(
	userId: string,
): Promise<CachedProfile | null> {
	const cached = profileCache.get(userId);
	if (cached) return cached;

	const [row] = await db
		.select()
		.from(userProfiles)
		.where(eq(userProfiles.userId, userId))
		.limit(1);

	if (!row) return null;

	const profile: CachedProfile = {
		userId,
		profileVector: fromJson<number[]>(row.profileVector, []),
		avgEnergy: row.avgEnergy,
		avgValence: row.avgValence,
		avgDanceability: row.avgDanceability,
		avgAcousticness: row.avgAcousticness,
		preferredGenres: fromJson<Record<string, number>>(row.preferredGenres, {}),
		totalPlayCount: row.totalPlayCount ?? 0,
	};
	profileCache.set(userId, profile);
	return profile;
}
