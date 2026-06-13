import { prisma } from "../db/prisma.js";
import { fromJson, toJson } from "../db/helpers.js";
import {
	sessionCache,
	type RecommendedTrack,
	type SessionQueueData,
} from "../cache/index.js";
import { recommend } from "./recommender.js";
import { config } from "../config.js";
import { scheduleProfileUpdate } from "../workers/runner.js";

export async function initQueue(opts: {
	userId: string;
	sessionId: string;
	seedTrackId?: string | null;
}): Promise<RecommendedTrack[]> {
	const { userId, sessionId, seedTrackId } = opts;
	const tracks = await recommend({
		userId,
		surface: "queue",
		seedTrackId,
		excludeIds: seedTrackId ? [seedTrackId] : [],
	});

	const data: SessionQueueData = { tracks, playedIds: [] };
	sessionCache.set(sessionId, data);
	await persistQueue(sessionId, userId, data);
	return tracks;
}

export async function updateQueue(opts: {
	userId: string;
	sessionId: string;
	currentTrackId: string;
	playedRatio: number;
}): Promise<RecommendedTrack[]> {
	const { userId, sessionId, currentTrackId, playedRatio } = opts;

	let data = sessionCache.get(sessionId) ?? (await loadQueue(sessionId));
	if (!data) data = { tracks: [], playedIds: [] };

	data.tracks = data.tracks.filter((t) => t.trackId !== currentTrackId);
	data.playedIds = [
		...data.playedIds.slice(-(config.playedIdsHistoryCap - 1)),
		currentTrackId,
	];

	if (playedRatio >= config.highSignalCompletionRatio) {
		scheduleProfileUpdate(userId);
	}

	if (data.tracks.length < config.queueLowWaterMark) {
		const exclude = [...new Set(data.playedIds)];
		const newTracks = await recommend({
			userId,
			surface: "queue",
			seedTrackId: currentTrackId,
			limit: config.queueSize,
			excludeIds: exclude,
		});
		const existing = new Set(data.tracks.map((t) => t.trackId));
		for (const t of newTracks) {
			if (!existing.has(t.trackId)) {
				data.tracks.push(t);
				existing.add(t.trackId);
			}
		}
	}

	data.tracks = data.tracks.slice(0, config.queueSize);
	sessionCache.set(sessionId, data);
	await persistQueue(sessionId, userId, data);
	return data.tracks;
}

export async function getQueue(sessionId: string): Promise<RecommendedTrack[]> {
	const data = sessionCache.get(sessionId) ?? (await loadQueue(sessionId));
	return data?.tracks ?? [];
}

// ── Database persistence ──────────────────────────────────────────────────────
async function persistQueue(
	sessionId: string,
	userId: string,
	data: SessionQueueData,
) {
	const nowUnix = Math.floor(Date.now() / 1000);
	const queueJson = toJson(data.tracks);
	const playedIds = toJson(data.playedIds);
	const expiresAt = nowUnix + Math.floor(config.sessionTtlMs / 1000);
	await prisma.sessionQueue.upsert({
		where: { sessionId },
		create: {
			sessionId,
			userId,
			queueJson,
			playedIds,
			expiresAt,
			updatedAt: nowUnix,
		},
		update: { userId, queueJson, playedIds, expiresAt, updatedAt: nowUnix },
	});
}

async function loadQueue(sessionId: string): Promise<SessionQueueData | null> {
	const row = await prisma.sessionQueue.findUnique({ where: { sessionId } });
	if (!row) return null;
	const nowUnix = Math.floor(Date.now() / 1000);
	if (row.expiresAt < nowUnix) return null;
	return {
		tracks: fromJson<RecommendedTrack[]>(row.queueJson, []),
		playedIds: fromJson<string[]>(row.playedIds, []),
	};
}
