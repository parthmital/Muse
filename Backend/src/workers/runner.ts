/**
 * src/workers/runner.ts
 * SQLite-backed job queue worker. Run as a separate process:
 *   npx tsx src/workers/runner.ts
 *
 * Jobs are polled every WORKER_POLL_MS ms.
 * Concurrency is capped at WORKER_CONCURRENCY.
 * Nightly rebuild scheduled via node-schedule.
 */

import { eq, and, lte, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import schedule from "node-schedule";
import pLimit from "p-limit";
import { db, fromJson, toJson } from "../db/client.js";
import { jobs } from "../db/schema.js";
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
	const nowUnix = Math.floor(Date.now() / 1000);

	// Atomic claim: update status to running and return claimed IDs
	const pending = await db
		.select({
			id: jobs.id,
			type: jobs.type,
			payload: jobs.payload,
			attempts: jobs.attempts,
		})
		.from(jobs)
		.where(
			and(eq(jobs.status, "pending"), lte(jobs.scheduledAt as any, nowUnix)),
		)
		.limit(config.workerConcurrency);

	if (!pending.length) return;

	await db
		.update(jobs)
		.set({ status: "running", startedAt: nowUnix })
		.where(
			inArray(
				jobs.id,
				pending.map((j) => j.id),
			),
		);

	await Promise.all(
		pending.map((job) =>
			limit(async () => {
				const handler = HANDLERS[job.type as JobType];
				if (!handler) {
					await db
						.update(jobs)
						.set({
							status: "failed",
							error: `Unknown job type: ${job.type}`,
							completedAt: Math.floor(Date.now() / 1000),
						})
						.where(eq(jobs.id, job.id));
					return;
				}

				try {
					const payload = fromJson(job.payload, {});
					await handler(payload);
					await db
						.update(jobs)
						.set({ status: "done", completedAt: Math.floor(Date.now() / 1000) })
						.where(eq(jobs.id, job.id));
				} catch (err) {
					const attempts = (job.attempts ?? 0) + 1;
					const max = 3;
					const retryIn = attempts * 60; // back-off: 1m, 2m, 3m
					await db
						.update(jobs)
						.set({
							status: attempts >= max ? "failed" : "pending",
							attempts,
							scheduledAt: Math.floor(Date.now() / 1000) + retryIn,
							error: String(err),
						})
						.where(eq(jobs.id, job.id));
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
	await db.insert(jobs).values({
		type,
		payload: toJson(payload),
		status: "pending",
		scheduledAt: Math.floor(Date.now() / 1000),
	});
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
	console.log(
		`Worker starting. poll=${config.workerPollMs}ms concurrency=${config.workerConcurrency}`,
	);
	process.on("SIGINT", () => {
		running = false;
	});
	poll().then(() => console.log("Worker stopped."));
}
