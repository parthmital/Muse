/**
 * src/db/helpers.ts
 *
 * Shared DB query helpers used across multiple API routes.
 */

import Database from "better-sqlite3";

// The raw sqlite instance is set by db/client.ts at startup
let _db: Database.Database;

export function setDbInstance(db: Database.Database) {
	_db = db;
}

export function getDb(): Database.Database {
	if (!_db) throw new Error("Database not initialized");
	return _db;
}

// ── User resolution ─────────────────────────────────────────────────────────

export interface UserRow {
	id: string;
	external_id: string;
	is_new: number;
	created_at: number;
	updated_at: number;
}

/**
 * Resolve a user by their external ID.
 * Returns the user row or null if not found.
 */
export function resolveUser(externalId: string): UserRow | null {
	const db = getDb();
	return (
		(db
			.prepare("SELECT * FROM users WHERE external_id = ? LIMIT 1")
			.get(externalId) as UserRow | undefined) ?? null
	);
}

/**
 * Resolve user by internal ID.
 */
export function resolveUserById(id: string): UserRow | null {
	const db = getDb();
	return (
		(db.prepare("SELECT * FROM users WHERE id = ? LIMIT 1").get(id) as
			| UserRow
			| undefined) ?? null
	);
}

// ── JSON helpers ────────────────────────────────────────────────────────────

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
