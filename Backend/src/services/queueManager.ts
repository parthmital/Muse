import { getDb, fromJson, toJson } from "../db/helpers.js";
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

	data.tracks = data.tracks.filter((t) => t.trackId !== currentTrackId);
	data.playedIds = [...data.playedIds.slice(-199), currentTrackId];

	if (playedRatio >= 0.8) {
		scheduleProfileUpdate(userId);
	}

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

// ── SQLite persistence ────────────────────────────────────────────────────────
async function persistQueue(
	sessionId: string,
	userId: string,
	data: SessionQueueData,
) {
	const db = getDb();
	const nowUnix = Math.floor(Date.now() / 1000);
	db.prepare(
		`INSERT INTO session_queues (session_id, user_id, queue_json, played_ids, expires_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(session_id) DO UPDATE SET
			queue_json = excluded.queue_json,
			played_ids = excluded.played_ids,
			expires_at = excluded.expires_at,
			updated_at = excluded.updated_at`,
	).run(
		sessionId,
		userId,
		toJson(data.tracks),
		toJson(data.playedIds),
		nowUnix + SESSION_TTL_MS / 1000,
		nowUnix,
	);
}

async function loadQueue(sessionId: string): Promise<SessionQueueData | null> {
	const db = getDb();
	const row = db
		.prepare("SELECT * FROM session_queues WHERE session_id = ? LIMIT 1")
		.get(sessionId) as any;
	if (!row) return null;
	const nowUnix = Math.floor(Date.now() / 1000);
	if (row.expires_at < nowUnix) return null;
	return {
		tracks: fromJson<RecommendedTrack[]>(row.queue_json, []),
		playedIds: fromJson<string[]>(row.played_ids, []),
	};
}
