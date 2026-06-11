/**
 * Playlist data access (Prisma).
 *
 * Centralises the playlist + playlist_tracks queries that were previously inline
 * raw SQL in library.ts, including the ownership checks used to authorize
 * mutations.
 */
import type { Playlist, PlaylistTrack } from "@prisma/client";
import { prisma } from "../prisma.js";

export function listPlaylists(userId: string): Promise<Playlist[]> {
	return prisma.playlist.findMany({
		where: { userId },
		orderBy: { updatedAt: "desc" },
	});
}

export function createPlaylist(
	id: string,
	userId: string,
	title: string,
	description: string | null,
): Promise<Playlist> {
	return prisma.playlist.create({
		data: { id, userId, title, description },
	});
}

/** Delete a playlist the user owns. Returns true if a row was removed. */
export async function deletePlaylist(
	id: string,
	userId: string,
): Promise<boolean> {
	const res = await prisma.playlist.deleteMany({ where: { id, userId } });
	return res.count > 0;
}

export async function userOwnsPlaylist(
	id: string,
	userId: string,
): Promise<boolean> {
	const row = await prisma.playlist.findFirst({
		where: { id, userId },
		select: { id: true },
	});
	return !!row;
}

export function listPlaylistTracks(
	playlistId: string,
): Promise<PlaylistTrack[]> {
	return prisma.playlistTrack.findMany({
		where: { playlistId },
		orderBy: { position: "asc" },
	});
}

/** Append a track to a playlist at the next position. */
export async function addTrackToPlaylist(
	playlistId: string,
	trackId: string,
): Promise<void> {
	const agg = await prisma.playlistTrack.aggregate({
		where: { playlistId },
		_max: { position: true },
	});
	const position = (agg._max.position ?? 0) + 1;
	await prisma.playlistTrack.create({
		data: { playlistId, trackId, position },
	});
}

export async function removeTrackFromPlaylist(
	playlistId: string,
	trackId: string,
): Promise<void> {
	await prisma.playlistTrack.deleteMany({ where: { playlistId, trackId } });
}
