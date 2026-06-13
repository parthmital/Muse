/**
 * Catalog persistence (Prisma).
 *
 * Single home for the "insert a Tidal entity into our local catalog if we
 * haven't seen it" logic that was previously copy-pasted across recommender.ts
 * and homepageBuilder.ts. upsert(..., update: {}) gives insert-or-ignore
 * semantics: create on first sight, never clobber on repeat.
 */
import { prisma } from "../prisma.js";
import { toJson } from "../helpers.js";
import type { HifiTrack } from "../../services/hifiClient.js";

/** Persist a Tidal track plus its artist and album (best-effort, idempotent). */
export async function upsertHifiTrack(t: HifiTrack): Promise<void> {
	const trackId = String(t.id);
	try {
		if (t.artist?.id) {
			const artistId = String(t.artist.id);
			await prisma.artist.upsert({
				where: { id: artistId },
				create: {
					id: artistId,
					name: t.artist.name,
					popularity: t.artist.popularity ?? null,
					pictureUrl: t.artist.picture ?? null,
					rawApiData: toJson(t.artist),
				},
				update: {},
			});
		}
		if (t.album?.id) {
			const albumId = String(t.album.id);
			await prisma.album.upsert({
				where: { id: albumId },
				create: {
					id: albumId,
					title: t.album.title,
					coverUrl: t.album.cover ?? null,
					vibrantColor: t.album.vibrantColor ?? null,
					rawApiData: toJson(t.album),
				},
				update: {},
			});
		}
		await prisma.track.upsert({
			where: { id: trackId },
			create: {
				id: trackId,
				title: t.title,
				duration: t.duration ?? null,
				bpm: t.bpm ?? null,
				key: t.key ?? null,
				keyScale: t.keyScale ?? null,
				popularity: t.popularity ?? null,
				explicit: t.explicit ? 1 : 0,
				audioQuality: t.audioQuality ?? null,
				isrc: t.isrc ?? null,
				mixIds: toJson(t.mixes ?? {}),
				rawApiData: toJson(t),
				artistId: t.artist?.id ? String(t.artist.id) : null,
				albumId: t.album?.id ? String(t.album.id) : null,
			},
			update: {},
		});
		await prisma.trackFeatures.upsert({
			where: { trackId },
			create: { trackId, enrichmentStatus: "pending" },
			update: {},
		});
	} catch {
		// Best-effort persistence; the caller still returns the track.
	}
}

/** Persist a minimal album record (best-effort, idempotent). */
export async function upsertAlbumBasic(
	id: string,
	title: string,
	coverUrl: string | null,
	rawApiData: string,
): Promise<void> {
	try {
		await prisma.album.upsert({
			where: { id },
			create: { id, title, coverUrl, rawApiData },
			update: {},
		});
	} catch {
		// Best-effort persistence.
	}
}
