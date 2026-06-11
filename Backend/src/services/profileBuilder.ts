import { prisma } from "../db/prisma.js";
import { fromJson, toJson } from "../db/helpers.js";
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

/**
 * Builds a lightweight user profile: genre preferences derived from the genres
 * of tracks the user has interacted with, weighted by event type, completion,
 * and recency. Used to bias genre-based homepage sections. Personalised track
 * recommendations are generated separately from listening seeds via Last.fm.
 */
export async function buildProfile(
	userId: string,
): Promise<CachedProfile | null> {
	// Fetch interactions (most recent N)
	const interactions = await prisma.userInteraction.findMany({
		where: { userId },
		orderBy: { occurredAt: "desc" },
		take: config.profileInteractionLimit,
	});

	if (!interactions.length) return null;

	const trackIds = [
		...new Set(
			interactions.map((i) => i.trackId).filter((v): v is string => !!v),
		),
	];

	const featMap = new Map<string, { genre: string | null }>();
	if (trackIds.length) {
		const features = await prisma.trackFeatures.findMany({
			where: { trackId: { in: trackIds }, enrichmentStatus: "done" },
			select: { trackId: true, genre: true },
		});
		for (const f of features) featMap.set(f.trackId, { genre: f.genre });
	}

	// Compute per-track weights (recency-decayed).
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

	// Aggregate weighted genre preferences.
	const genreAccum = new Map<string, number>();
	for (const [tid, weight] of weightMap) {
		const feat = featMap.get(tid);
		if (!feat?.genre) continue;
		genreAccum.set(
			feat.genre,
			(genreAccum.get(feat.genre) ?? 0) + Math.abs(weight),
		);
	}

	const totalGenreW = [...genreAccum.values()].reduce((s, v) => s + v, 1e-9);
	const preferredGenres = Object.fromEntries(
		[...genreAccum.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, config.profileMaxGenres)
			.map(([g, w]) => [g, +(w / totalGenreW).toFixed(4)]),
	);

	const profile: CachedProfile = {
		userId,
		preferredGenres,
		totalPlayCount: interactions.length,
	};

	// Persist to SQLite (upsert)
	const nowUnix = Math.floor(Date.now() / 1000);
	const serializedGenres = toJson(preferredGenres);
	await prisma.userProfile.upsert({
		where: { userId },
		create: {
			userId,
			preferredGenres: serializedGenres,
			totalPlayCount: interactions.length,
			uniqueTracksPlayed: trackIds.length,
			updatedAt: nowUnix,
		},
		update: {
			preferredGenres: serializedGenres,
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

	const row = await prisma.userProfile.findUnique({ where: { userId } });
	if (!row) return null;

	const profile: CachedProfile = {
		userId,
		preferredGenres: fromJson<Record<string, number>>(row.preferredGenres, {}),
		totalPlayCount: row.totalPlayCount ?? 0,
	};
	profileCache.set(userId, profile);
	return profile;
}
