/**
 * User library data access (Prisma).
 *
 * Single home for the user_library read/toggle logic that was previously
 * duplicated across actions.ts, contextMenu.ts and library.ts. Mutations
 * invalidate the user's profile + recommendation caches (Phase 10) so a like or
 * save is reflected immediately instead of being masked by a stale cache.
 */
import type { UserLibrary } from "@prisma/client";
import { prisma } from "../prisma.js";
import { invalidateProfile } from "../../cache/index.js";

const byUserItem = (userId: string, itemType: string, itemId: string) => ({
	user_library_unique: { userId, itemType, itemId },
});

/** Current library row for an item, or null. */
export function getLibraryEntry(
	userId: string,
	itemType: string,
	itemId: string,
): Promise<UserLibrary | null> {
	return prisma.userLibrary.findUnique({
		where: byUserItem(userId, itemType, itemId),
	});
}

/** Add the item if absent, remove it if present. Returns the new active state. */
export async function toggleLibraryItem(
	userId: string,
	itemType: string,
	itemId: string,
): Promise<boolean> {
	const existing = await getLibraryEntry(userId, itemType, itemId);
	if (existing) {
		await prisma.userLibrary.delete({ where: { id: existing.id } });
		invalidateProfile(userId);
		return false;
	}
	await prisma.userLibrary.create({ data: { userId, itemType, itemId } });
	invalidateProfile(userId);
	return true;
}

/** Toggle the pin flag (creating a pinned row if absent). Returns new pin state. */
export async function togglePin(
	userId: string,
	itemType: string,
	itemId: string,
): Promise<boolean> {
	const existing = await getLibraryEntry(userId, itemType, itemId);
	if (existing) {
		const isPinned = existing.isPinned ? 0 : 1;
		await prisma.userLibrary.update({
			where: { id: existing.id },
			data: { isPinned },
		});
		return !!isPinned;
	}
	await prisma.userLibrary.create({
		data: { userId, itemType, itemId, isPinned: 1 },
	});
	return true;
}

/** Add an item (idempotent). */
export async function addLibraryItem(
	userId: string,
	itemType: string,
	itemId: string,
): Promise<void> {
	await prisma.userLibrary.upsert({
		where: byUserItem(userId, itemType, itemId),
		create: { userId, itemType, itemId },
		update: {},
	});
	invalidateProfile(userId);
}

/** Remove an item (idempotent). */
export async function removeLibraryItem(
	userId: string,
	itemType: string,
	itemId: string,
): Promise<void> {
	await prisma.userLibrary.deleteMany({ where: { userId, itemType, itemId } });
	invalidateProfile(userId);
}

/** List a user's library rows of a given type, newest first. */
export function listLibrary(
	userId: string,
	itemType?: string,
): Promise<UserLibrary[]> {
	return prisma.userLibrary.findMany({
		where: { userId, ...(itemType ? { itemType } : {}) },
		orderBy: { addedAt: "desc" },
	});
}
