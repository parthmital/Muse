/**
 * User settings data access (Prisma).
 *
 * Booleans are stored as SQLite integers (0/1), matching the rest of the schema
 * (is_new, is_pinned, explicit). This module exposes them as real booleans at
 * the application boundary.
 */
import { prisma } from "../prisma.js";

export interface UserSettings {
	streamingQuality: string;
	downloadQuality: string;
	dataSaver: boolean;
	gaplessPlayback: boolean;
	automix: boolean;
	allowExplicit: boolean;
}

const DEFAULTS: UserSettings = {
	streamingQuality: "high",
	downloadQuality: "high",
	dataSaver: false,
	gaplessPlayback: true,
	automix: true,
	allowExplicit: true,
};

function toBool(n: number): boolean {
	return n !== 0;
}

/** Read a user's settings, returning defaults if no row exists yet. */
export async function getSettings(userId: string): Promise<UserSettings> {
	const row = await prisma.userSetting.findUnique({ where: { userId } });
	if (!row) return { ...DEFAULTS };
	return {
		streamingQuality: row.streamingQuality,
		downloadQuality: row.downloadQuality,
		dataSaver: toBool(row.dataSaver),
		gaplessPlayback: toBool(row.gaplessPlayback),
		automix: toBool(row.automix),
		allowExplicit: toBool(row.allowExplicit),
	};
}

/** Upsert a user's settings from a partial patch, returning the merged result. */
export async function saveSettings(
	userId: string,
	patch: Partial<UserSettings>,
): Promise<UserSettings> {
	const merged = { ...(await getSettings(userId)), ...patch };
	const data = {
		streamingQuality: merged.streamingQuality,
		downloadQuality: merged.downloadQuality,
		dataSaver: merged.dataSaver ? 1 : 0,
		gaplessPlayback: merged.gaplessPlayback ? 1 : 0,
		automix: merged.automix ? 1 : 0,
		allowExplicit: merged.allowExplicit ? 1 : 0,
	};
	await prisma.userSetting.upsert({
		where: { userId },
		update: data,
		create: { userId, ...data },
	});
	return merged;
}
