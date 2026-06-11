/**
 * Job queue data access (Prisma).
 *
 * Adds the durability guarantees the previous raw-SQL queue lacked:
 *  - enqueue is idempotent via a unique (type, dedup_key) constraint, so the
 *    same logical job can't stack up while it is pending/running;
 *  - claiming leases a job (lease_until) so a crashed worker's job is reaped
 *    and retried instead of being stuck in 'running' forever;
 *  - retry/backoff and max-attempts are configurable.
 *
 * dedup_key is cleared when a job reaches a terminal state, so a future enqueue
 * of the same logical job is allowed once the previous one finishes.
 */
import { Prisma, type Job } from "@prisma/client";
import { prisma } from "../prisma.js";
import { config } from "../../config.js";
import { toJson } from "../helpers.js";

export type { Job };

function nowSec(): number {
	return Math.floor(Date.now() / 1000);
}

/**
 * Enqueue a job. When `dedupKey` is provided, a no-op if an active job with the
 * same (type, dedupKey) already exists. Returns true if a row was inserted.
 */
export async function enqueueJob(
	type: string,
	payload: unknown,
	dedupKey: string | null = null,
): Promise<boolean> {
	// Fast path: skip the insert (and its noisy constraint error) when an active
	// job already covers this dedup key. The unique constraint below remains the
	// race-safe backstop.
	if (dedupKey) {
		const active = await prisma.job.findFirst({
			where: { type, dedupKey, status: { in: ["pending", "running"] } },
			select: { id: true },
		});
		if (active) return false;
	}
	try {
		await prisma.job.create({
			data: {
				type,
				payload: toJson(payload),
				dedupKey,
				status: "pending",
				scheduledAt: nowSec(),
			},
		});
		return true;
	} catch (err) {
		// P2002 = unique (type, dedup_key) violation → an active job already
		// covers this work; treat as a successful no-op.
		if (
			err instanceof Prisma.PrismaClientKnownRequestError &&
			err.code === "P2002"
		) {
			return false;
		}
		throw err;
	}
}

/**
 * Atomically claim up to `limit` runnable jobs: pending and past their
 * scheduled time, or previously leased but whose lease has expired (crashed
 * worker). Marks them running with a fresh lease.
 */
export async function claimJobs(limit: number): Promise<Job[]> {
	const ts = nowSec();
	const leaseUntil = ts + config.jobLeaseSec;
	return prisma.$transaction(async (tx) => {
		const candidates = await tx.job.findMany({
			where: {
				scheduledAt: { lte: ts },
				OR: [
					{ status: "pending" },
					{ status: "running", leaseUntil: { lt: ts } },
				],
			},
			orderBy: { scheduledAt: "asc" },
			take: limit,
		});
		if (!candidates.length) return [];
		await tx.job.updateMany({
			where: { id: { in: candidates.map((j) => j.id) } },
			data: { status: "running", startedAt: ts, leaseUntil },
		});
		// Reflect the claim in the returned rows (updateMany doesn't return them).
		return candidates.map((j) => ({
			...j,
			status: "running",
			startedAt: ts,
			leaseUntil,
		}));
	});
}

export function completeJob(id: number): Promise<unknown> {
	return prisma.job.update({
		where: { id },
		data: { status: "done", completedAt: nowSec(), dedupKey: null },
	});
}

/** Record a failure: reschedule with backoff, or mark failed past max attempts. */
export function failJob(
	id: number,
	priorAttempts: number,
	error: string,
): Promise<unknown> {
	const attempts = priorAttempts + 1;
	const terminal = attempts >= config.jobMaxAttempts;
	return prisma.job.update({
		where: { id },
		data: terminal
			? {
					status: "failed",
					attempts,
					error,
					completedAt: nowSec(),
					dedupKey: null,
					leaseUntil: null,
				}
			: {
					status: "pending",
					attempts,
					error,
					scheduledAt: nowSec() + attempts * config.jobRetryBaseSec,
					leaseUntil: null,
				},
	});
}

/** Periodic maintenance: prune expired Last.fm cache and old impressions. */
export async function cleanupMaintenance(): Promise<void> {
	const ts = nowSec();
	await prisma.lastfmCache.deleteMany({
		where: { expiresAt: { lt: ts - config.lastfmCacheGraceDays * 86400 } },
	});
	await prisma.shelfImpression.deleteMany({
		where: {
			shownAt: { lt: ts - config.shelfImpressionRetentionDays * 86400 },
		},
	});
}
