/**
 * src/workers/runner.ts
 * SQLite-backed job queue worker. Run as a separate process:
 *   npx tsx src/workers/runner.ts
 *
 * Jobs are polled every WORKER_POLL_MS ms.
 * Concurrency is capped at WORKER_CONCURRENCY.
 * Nightly rebuild scheduled via node-schedule.
 */

import schedule from "node-schedule";
import pLimit from "p-limit";
import { runMigrations } from "../db/client.js";
import { getDb, fromJson, toJson } from "../db/helpers.js";
import { config } from "../config.js";
import { handleEnrichTrack } from "./jobs/enrichTrack.js";
import { handleUpdateProfile } from "./jobs/updateProfile.js";
import { handleRebuildIndex } from "./jobs/rebuildIndex.js";

type JobType = "enrich_track" | "update_profile" | "rebuild_index";

const HANDLERS: Record<JobType, (payload: unknown) => Promise<void>> = {
	enrich_track: handleEnrichTrack,
	update_profile: handleUpdateProfile,
	rebuild_index: handleRebuildIndex,
};

const limit = pLimit(config.workerConcurrency);
let running = true;

async function claimAndRun() {
	const db = getDb();
	const nowUnix = Math.floor(Date.now() / 1000);

	const pending = db
		.prepare(
			"SELECT id, type, payload, attempts FROM jobs WHERE status = 'pending' AND scheduled_at <= ? LIMIT ?",
		)
		.all(nowUnix, config.workerConcurrency) as any[];

	if (!pending.length) return;

	const ids = pending.map((j: any) => j.id);
	const placeholders = ids.map(() => "?").join(",");
	db.prepare(
		`UPDATE jobs SET status = 'running', started_at = ? WHERE id IN (${placeholders})`,
	).run(nowUnix, ...ids);

	await Promise.all(
		pending.map((job: any) =>
			limit(async () => {
				const handler = HANDLERS[job.type as JobType];
				if (!handler) {
					db.prepare(
						"UPDATE jobs SET status = 'failed', error = ?, completed_at = ? WHERE id = ?",
					).run(
						`Unknown job type: ${job.type}`,
						Math.floor(Date.now() / 1000),
						job.id,
					);
					return;
				}

				try {
					const payload = fromJson(job.payload, {});
					await handler(payload);
					db.prepare(
						"UPDATE jobs SET status = 'done', completed_at = ? WHERE id = ?",
					).run(Math.floor(Date.now() / 1000), job.id);
				} catch (err) {
					const attempts = (job.attempts ?? 0) + 1;
					const max = 3;
					const retryIn = attempts * 60;
					db.prepare(
						"UPDATE jobs SET status = ?, attempts = ?, scheduled_at = ?, error = ? WHERE id = ?",
					).run(
						attempts >= max ? "failed" : "pending",
						attempts,
						Math.floor(Date.now() / 1000) + retryIn,
						String(err),
						job.id,
					);
				}
			}),
		),
	);
}

async function poll() {
	while (running) {
		try {
			await claimAndRun();
		} catch (err) {
			console.error("Worker poll error:", err);
		}
		await sleep(config.workerPollMs);
	}
}

function sleep(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

// ── Schedule nightly FAISS rebuild ────────────────────────────────────────────
schedule.scheduleJob("0 3 * * *", () => enqueueJob("rebuild_index", {}));

// ── Public helpers for enqueuing ──────────────────────────────────────────────
export async function enqueueJob(type: JobType, payload: unknown) {
	const db = getDb();
	db.prepare(
		"INSERT INTO jobs (type, payload, status, scheduled_at) VALUES (?, ?, 'pending', ?)",
	).run(type, toJson(payload), Math.floor(Date.now() / 1000));
}

export function scheduleEnrichTrack(trackId: string) {
	enqueueJob("enrich_track", { trackId }).catch(console.error);
}

export function scheduleProfileUpdate(userId: string) {
	enqueueJob("update_profile", { userId }).catch(console.error);
}

// ── Entry point ───────────────────────────────────────────────────────────────
if (
	process.argv[1]?.endsWith("runner.ts") ||
	process.argv[1]?.endsWith("runner.js")
) {
	try {
		runMigrations();
	} catch (e) {
		console.error("Migration error:", e);
	}
	console.log(
		`Worker starting. poll=${config.workerPollMs}ms concurrency=${config.workerConcurrency}`,
	);
	process.on("SIGINT", () => {
		running = false;
	});
	poll().then(() => console.log("Worker stopped."));
}
