/**
 * src/db/prisma.ts
 *
 * Single PrismaClient instance backed by the pg driver adapter (Prisma 7),
 * talking to PostgreSQL. The connection string comes from config.databaseUrl
 * (DATABASE_URL). A small connection pool is shared by the API server and the
 * worker process.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "../config.js";

const adapter = new PrismaPg({ connectionString: config.databaseUrl });

export const prisma = new PrismaClient({
	adapter,
	log:
		config.logLevel === "debug"
			? ["query", "warn", "error"]
			: ["warn", "error"],
});

let initialized = false;

/**
 * Establishes the database connection eagerly. Idempotent — safe to call from
 * both the API server and the worker process on startup.
 */
export async function initDb(): Promise<void> {
	if (initialized) return;
	initialized = true;
	await prisma.$connect();
}

/** Graceful shutdown helper. */
export async function disconnectDb(): Promise<void> {
	await prisma.$disconnect();
}
