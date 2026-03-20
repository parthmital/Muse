import { eq } from "drizzle-orm";
import { db, fromJson, toJson } from "../db/client.js";
import { sessionQueues } from "../db/schema.js";
import {
	sessionCache,
	type RecommendedTrack,
	type SessionQueueData,
} from "../cache/index.js";
import { recommend } from "./recommender.js";
import { config } from "../config.js";
import { scheduleProfileUpdate } from "../workers/runner.js";

const LOW_WATER_MARK = 5;
const SESSION_TTL_MS = 3 * 60 * 60 * 1000;

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

	// Remove current track from queue
	data.tracks = data.tracks.filter((t) => t.trackId !== currentTrackId);
	data.playedIds = [...data.playedIds.slice(-199), currentTrackId];

	if (playedRatio >= 0.8) {
		scheduleProfileUpdate(userId);
	}

	// Refill if below watermark
	if (data.tracks.length < LOW_WATER_MARK) {
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

// ── SQLite persistence (recovery across restarts) ─────────────────────────────
async function persistQueue(
	sessionId: string,
	userId: string,
	data: SessionQueueData,
) {
	const nowUnix = Math.floor(Date.now() / 1000);
	await db
		.insert(sessionQueues)
		.values({
			sessionId,
			userId,
			queueJson: toJson(data.tracks),
			playedIds: toJson(data.playedIds),
			expiresAt: nowUnix + SESSION_TTL_MS / 1000,
			updatedAt: nowUnix,
		})
		.onConflictDoUpdate({
			target: sessionQueues.sessionId,
			set: {
				queueJson: toJson(data.tracks),
				playedIds: toJson(data.playedIds),
				expiresAt: nowUnix + SESSION_TTL_MS / 1000,
				updatedAt: nowUnix,
			},
		});
}

async function loadQueue(sessionId: string): Promise<SessionQueueData | null> {
	const [row] = await db
		.select()
		.from(sessionQueues)
		.where(eq(sessionQueues.sessionId, sessionId))
		.limit(1);
	if (!row) return null;
	const nowUnix = Math.floor(Date.now() / 1000);
	if (row.expiresAt < nowUnix) return null;
	return {
		tracks: fromJson<RecommendedTrack[]>(row.queueJson, []),
		playedIds: fromJson<string[]>(row.playedIds, []),
	};
}
