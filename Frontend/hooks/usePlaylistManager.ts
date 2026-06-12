"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import {
	API_BASE,
	swrFetcher,
	addTrackToPlaylist,
	removeTrackFromPlaylist,
	getPlaylistTracks,
	createPlaylist as apiCreatePlaylist,
} from "@/lib/api";

export function usePlaylistManager() {
	const { data, mutate } = useSWR<{
		playlists: { id: string; title: string }[];
	}>(`${API_BASE}/playlists`, swrFetcher);

	const isInitialized = data !== undefined;

	/** Resolve a playlist by id or title. */
	const resolvePlaylist = useCallback(
		(playlistKey: string) =>
			data?.playlists.find(
				(p) => p.id === playlistKey || p.title === playlistKey,
			),
		[data],
	);

	/**
	 * Add the song if it isn't already in the playlist, otherwise remove it.
	 * Fetches the current tracks first to decide. (Backend returns camelCase
	 * `trackId`.)
	 */
	const toggleSongInPlaylist = useCallback(
		async (playlistKey: string, songKey: string) => {
			const p = resolvePlaylist(playlistKey);
			if (!p) return;

			const tracksData = await getPlaylistTracks(p.id);
			const isIn = tracksData.tracks?.some((t) => t.trackId === songKey);

			if (isIn) {
				await removeTrackFromPlaylist(p.id, songKey);
			} else {
				await addTrackToPlaylist(p.id, songKey);
			}
			mutate();
			return !isIn;
		},
		[resolvePlaylist, mutate],
	);

	/**
	 * Async membership check: returns the set of playlist ids that currently
	 * contain `songKey`. Used by the add-to-playlist dialog to show checkmarks.
	 */
	const playlistsContaining = useCallback(
		async (songKey: string): Promise<Set<string>> => {
			if (!data) return new Set();
			const results = await Promise.all(
				data.playlists.map(async (p) => {
					try {
						const tracksData = await getPlaylistTracks(p.id);
						return tracksData.tracks?.some((t) => t.trackId === songKey)
							? p.id
							: null;
					} catch {
						return null;
					}
				}),
			);
			return new Set(results.filter((id): id is string => id !== null));
		},
		[data],
	);

	/** Create a new playlist and revalidate the list; returns its id. */
	const createPlaylist = useCallback(
		async (title: string): Promise<string> => {
			const res = await apiCreatePlaylist(title);
			await mutate();
			return res.id;
		},
		[mutate],
	);

	return useMemo(
		() => ({
			data,
			isInitialized,
			toggleSongInPlaylist,
			playlistsContaining,
			createPlaylist,
		}),
		[
			data,
			isInitialized,
			toggleSongInPlaylist,
			playlistsContaining,
			createPlaylist,
		],
	);
}
