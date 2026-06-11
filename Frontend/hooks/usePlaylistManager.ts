"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import {
	API_BASE,
	swrFetcher,
	addTrackToPlaylist,
	removeTrackFromPlaylist,
	getPlaylistTracks,
} from "@/lib/api";

export function usePlaylistManager() {
	const { data, mutate } = useSWR<{
		playlists: { id: string; title: string }[];
	}>(`${API_BASE}/playlists`, swrFetcher);

	const isInitialized = data !== undefined;

	const toggleSongInPlaylist = useCallback(
		async (playlistName: string, songKey: string) => {
			if (!data) return;
			const p = data.playlists.find(
				(p) => p.title === playlistName || p.id === playlistName,
			);
			if (!p) return;

			// Fetch current tracks to check presence
			const tracksData = await getPlaylistTracks(p.id);
			const isIn = tracksData.tracks?.some((t) => t.track_id === songKey);

			if (isIn) {
				await removeTrackFromPlaylist(p.id, songKey);
			} else {
				await addTrackToPlaylist(p.id, songKey);
			}
			mutate();
		},
		[data, mutate],
	);

	const isSongInPlaylist = useCallback(
		(
			playlistName: string,
			songKey: string,
			defaultInPlaylist: boolean = false,
		) => {
			return defaultInPlaylist;
		},
		[],
	);

	return useMemo(
		() => ({
			data,
			playlistSongs: {},
			isInitialized,
			toggleSongInPlaylist,
			isSongInPlaylist,
		}),
		[data, isInitialized, toggleSongInPlaylist, isSongInPlaylist],
	);
}
