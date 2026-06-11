/**
 * src/db/helpers.ts
 *
 * Pure JSON (de)serialization helpers shared across the data layer. All
 * database access now goes through Prisma (see src/db/prisma.ts and
 * src/db/repositories/*); user resolution lives in repositories/users.ts.
 */

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
