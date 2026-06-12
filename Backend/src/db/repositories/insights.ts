/**
 * Listening insights (Prisma).
 *
 * Aggregates user_interactions into the user's most-played tracks and artists,
 * joined to the local catalog for display metadata. Returns empty arrays for
 * brand-new users with no history (drives the UI's empty states).
 */
import { prisma } from "../prisma.js";

export interface TopTrack {
	id: string;
	title: string;
	artist: string | null;
	artistId: string | null;
	album: string | null;
	coverUrl: string | null;
	playCount: number;
}

export interface TopArtist {
	id: string;
	name: string;
	pictureUrl: string | null;
	playCount: number;
}

/** The user's most-interacted tracks, most first. */
export async function topTracks(
	userId: string,
	limit: number,
): Promise<TopTrack[]> {
	const grouped = await prisma.userInteraction.groupBy({
		by: ["trackId"],
		where: { userId, trackId: { not: null } },
		_count: { trackId: true },
		orderBy: { _count: { trackId: "desc" } },
		take: limit,
	});

	const ids = grouped
		.map((g) => g.trackId)
		.filter((id): id is string => id !== null);
	if (ids.length === 0) return [];

	const tracks = await prisma.track.findMany({
		where: { id: { in: ids } },
		include: { artist: true, album: true },
	});
	const byId = new Map(tracks.map((t) => [t.id, t]));

	return grouped
		.map((g) => {
			const t = g.trackId ? byId.get(g.trackId) : undefined;
			if (!t) return null;
			return {
				id: t.id,
				title: t.title,
				artist: t.artist?.name ?? null,
				artistId: t.artistId ?? null,
				album: t.album?.title ?? null,
				coverUrl: t.album?.coverUrl ?? null,
				playCount: g._count.trackId,
			};
		})
		.filter((t): t is TopTrack => t !== null);
}

/** The user's most-interacted artists, most first. */
export async function topArtists(
	userId: string,
	limit: number,
): Promise<TopArtist[]> {
	const grouped = await prisma.userInteraction.groupBy({
		by: ["artistId"],
		where: { userId, artistId: { not: null } },
		_count: { artistId: true },
		orderBy: { _count: { artistId: "desc" } },
		take: limit,
	});

	const ids = grouped
		.map((g) => g.artistId)
		.filter((id): id is string => id !== null);
	if (ids.length === 0) return [];

	const artists = await prisma.artist.findMany({
		where: { id: { in: ids } },
	});
	const byId = new Map(artists.map((a) => [a.id, a]));

	return grouped
		.map((g) => {
			const a = g.artistId ? byId.get(g.artistId) : undefined;
			if (!a) return null;
			return {
				id: a.id,
				name: a.name,
				pictureUrl: a.pictureUrl ?? null,
				playCount: g._count.artistId,
			};
		})
		.filter((a): a is TopArtist => a !== null);
}
