import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema.js";
import { config } from "../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function openDb(): Database.Database {
	mkdirSync(dirname(config.sqlitePath), { recursive: true });

	const sqlite = new Database(config.sqlitePath);

	// ── Performance pragmas ────────────────────────────────────────────────────
	sqlite.pragma("journal_mode = WAL"); // concurrent reads + writes
	sqlite.pragma("synchronous = NORMAL"); // safe + fast (WAL handles crash recovery)
	sqlite.pragma("cache_size = -65536"); // 64MB page cache
	sqlite.pragma("temp_store = MEMORY"); // temp tables in RAM
	sqlite.pragma("mmap_size = 268435456"); // 256MB memory-mapped I/O
	sqlite.pragma("page_size = 4096");
	sqlite.pragma("wal_autocheckpoint = 1000");
	sqlite.pragma("foreign_keys = ON");

	return sqlite;
}

const sqlite = openDb();
export const db = drizzle(sqlite, { schema });

// ── Migrations ─────────────────────────────────────────────────────────────────
// Run with: drizzle-kit push (dev) or drizzle-kit generate + migrate (prod)
export function runMigrations() {
	// Root project root for drizzle folder: Backend/drizzle
	const migrationsPath = join(__dirname, "../../drizzle");
	migrate(db, { migrationsFolder: migrationsPath });
}

// ── Typed JSON helpers ─────────────────────────────────────────────────────────
// SQLite stores JSON as text; these helpers encode/decode transparently.

export function toJson<T>(value: T): string {
	return JSON.stringify(value);
}

export function fromJson<T>(value: string | null | undefined, fallback: T): T {
	if (!value) return fallback;
	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
}
