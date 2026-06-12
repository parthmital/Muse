/**
 * User data access (Prisma).
 *
 * Replaces the ad-hoc `SELECT * FROM users` lookups previously scattered across
 * routes and db/helpers. Returns Prisma `User` records (camelCase fields).
 */
import type { User } from "@prisma/client";
import { prisma } from "../prisma.js";

export type { User };

/** Resolve a user by their external ID, or null if not found. */
export function resolveUser(externalId: string): Promise<User | null> {
	return prisma.user.findUnique({ where: { externalId } });
}

/** Resolve a user by internal ID, or null if not found. */
export function resolveUserById(id: string): Promise<User | null> {
	return prisma.user.findUnique({ where: { id } });
}

/** Resolve a user by email (case-insensitive), or null if not found. */
export function resolveUserByEmail(email: string): Promise<User | null> {
	return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

/**
 * Create a credentialed account. `id` doubles as `externalId` (the value used as
 * the JWT subject and in ownership checks). Also seeds an empty profile.
 */
export async function createAccount(params: {
	id: string;
	email: string;
	passwordHash: string;
	displayName: string;
}): Promise<User> {
	const user = await prisma.user.create({
		data: {
			id: params.id,
			externalId: params.id,
			email: params.email.toLowerCase(),
			passwordHash: params.passwordHash,
			displayName: params.displayName,
			isNew: 1,
		},
	});
	await prisma.userProfile.upsert({
		where: { userId: params.id },
		update: {},
		create: { userId: params.id, totalPlayCount: 0 },
	});
	return user;
}

/**
 * Ensure a user (and its empty profile) exists. Idempotent. Used for the dev
 * user at startup and for auto-provisioning on first interaction.
 */
export async function ensureUser(
	id: string,
	externalId = id,
	isNew = 0,
): Promise<User> {
	const user = await prisma.user.upsert({
		where: { id },
		update: {},
		create: { id, externalId, isNew },
	});
	await prisma.userProfile.upsert({
		where: { userId: id },
		update: {},
		create: { userId: id, totalPlayCount: 0 },
	});
	return user;
}
