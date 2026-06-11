/**
 * src/db/prisma.ts
 *
 * Single PrismaClient instance backed by the better-sqlite3 driver adapter
 * (Prisma 7). Reuses the same embedded engine the project already depends on,
 * so no separate query-engine binary is downloaded.
 *
 * The SQLite file location comes from config.sqlitePath (resolved to an
 * absolute path so it is independent of process CWD). Performance pragmas that
 * previously lived in the raw better-sqlite3 client are applied once at startup
 * via initDb().
 */

import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "../config.js";

const dbFile = resolve(config.sqlitePath);
mkdirSync(dirname(dbFile), { recursive: true });

const adapter = new PrismaBetterSqlite3({ url: `file:${dbFile}` });

export const prisma = new PrismaClient({
	adapter,
	log:
		config.logLevel === "debug"
			? ["query", "warn", "error"]
			: ["warn", "error"],
});

let initialized = false;

/**
 * Applies SQLite performance pragmas. Idempotent — safe to call from both the
 * API server and the worker process on startup.
 */
export async function initDb(): Promise<void> {
	if (initialized) return;
	initialized = true;

	const pragmas = [
		"PRAGMA journal_mode = WAL",
		"PRAGMA synchronous = NORMAL",
		"PRAGMA cache_size = -65536",
		"PRAGMA temp_store = MEMORY",
		"PRAGMA mmap_size = 268435456",
		"PRAGMA wal_autocheckpoint = 1000",
		"PRAGMA foreign_keys = ON",
	];
	for (const p of pragmas) {
		await prisma.$executeRawUnsafe(p);
	}
}

/** Graceful shutdown helper. */
export async function disconnectDb(): Promise<void> {
	await prisma.$disconnect();
}
