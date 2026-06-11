/**
 * src/workers/runner.ts
 * SQLite-backed job queue worker. Run as a separate process:
 *   npx tsx src/workers/runner.ts
 *
 * Jobs are polled every WORKER_POLL_MS ms and claimed with a lease, so a
 * crashed worker's in-flight job is reaped and retried rather than stranded.
 * Concurrency is capped at WORKER_CONCURRENCY.
 */

import pLimit from "p-limit";
import { fromJson } from "../db/helpers.js";
import { initDb, disconnectDb } from "../db/prisma.js";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { incr } from "../metrics.js";
import {
	claimJobs,
	completeJob,
	failJob,
	enqueueJob as repoEnqueueJob,
	cleanupMaintenance,
} from "../db/repositories/jobs.js";
import { handleEnrichTrack } from "./jobs/enrichTrack.js";
import { handleUpdateProfile } from "./jobs/updateProfile.js";
import { handleBuildHomepage } from "./jobs/buildHomepage.js";

type JobType = "enrich_track" | "update_profile" | "build_homepage";

const HANDLERS: Record<JobType, (payload: unknown) => Promise<void>> = {
	enrich_track: handleEnrichTrack,
	update_profile: handleUpdateProfile,
	build_homepage: handleBuildHomepage,
};

const log = logger.child({ scope: "worker" });
const limit = pLimit(config.workerConcurrency);
let running = true;

async function claimAndRun() {
	const jobs = await claimJobs(config.workerConcurrency);
	if (!jobs.length) return;

	await Promise.all(
		jobs.map((job) =>
			limit(async () => {
				const handler = HANDLERS[job.type as JobType];
				if (!handler) {
					await failJob(
						job.id,
						config.jobMaxAttempts,
						`Unknown job type: ${job.type}`,
					);
					log.warn({ jobId: job.id, type: job.type }, "Unknown job type");
					return;
				}
				try {
					await handler(fromJson(job.payload, {}));
					await completeJob(job.id);
					incr(`job_done:${job.type}`);
				} catch (err) {
					await failJob(job.id, job.attempts, String(err));
					incr(`job_failed:${job.type}`);
					log.error({ jobId: job.id, type: job.type, err }, "Job failed");
				}
			}),
		),
	);
}

let lastCleanup = 0;
async function cleanupExpired() {
	const now = Date.now();
	if (now - lastCleanup < config.jobCleanupIntervalMs) return;
	lastCleanup = now;
	try {
		await cleanupMaintenance();
	} catch (err) {
		log.warn({ err }, "Maintenance cleanup failed (non-critical)");
	}
}

async function poll() {
	while (running) {
		try {
			await claimAndRun();
			await cleanupExpired();
		} catch (err) {
			log.error({ err }, "Worker poll error");
		}
		await sleep(config.workerPollMs);
	}
}

function sleep(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

// ── Public helpers for enqueuing ──────────────────────────────────────────────
export function enqueueJob(type: JobType, payload: unknown, dedupKey?: string) {
	return repoEnqueueJob(type, payload, dedupKey ?? null);
}

export function scheduleEnrichTrack(trackId: string) {
	repoEnqueueJob("enrich_track", { trackId }, trackId).catch((err) =>
		log.error({ err, trackId }, "Failed to enqueue enrich_track"),
	);
}

export function scheduleProfileUpdate(userId: string) {
	repoEnqueueJob("update_profile", { userId }, userId).catch((err) =>
		log.error({ err, userId }, "Failed to enqueue update_profile"),
	);
}

// ── Entry point ───────────────────────────────────────────────────────────────
if (
	process.argv[1]?.endsWith("runner.ts") ||
	process.argv[1]?.endsWith("runner.js")
) {
	await initDb();
	log.info(
		{ poll: config.workerPollMs, concurrency: config.workerConcurrency },
		"Worker starting",
	);
	process.on("SIGINT", () => {
		running = false;
		void disconnectDb().finally(() => process.exit(0));
	});
	poll().then(() => log.info("Worker stopped"));
}
