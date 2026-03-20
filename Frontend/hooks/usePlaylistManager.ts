"use client";

import { useLocalStorage } from "./useLocalStorage";
import { useCallback, useMemo } from "react";

export function usePlaylistManager() {
	const [playlistSongs, setPlaylistSongs, isInitialized] = useLocalStorage<
		Record<string, Record<string, boolean>>
	>("playlistSongs", {});

	const toggleSongInPlaylist = useCallback(
		(playlistName: string, songKey: string) => {
			const currentPlaylist = playlistSongs[playlistName] ?? {};
			const newPlaylist = {
				...currentPlaylist,
				[songKey]: !currentPlaylist[songKey],
			};
			setPlaylistSongs({ ...playlistSongs, [playlistName]: newPlaylist });
		},
		[playlistSongs, setPlaylistSongs],
	);

	const isSongInPlaylist = useCallback(
		(
			playlistName: string,
			songKey: string,
			defaultInPlaylist: boolean = false,
		) => {
			return playlistSongs[playlistName]?.[songKey] ?? defaultInPlaylist;
		},
		[playlistSongs],
	);

	return useMemo(
		() => ({
			playlistSongs,
			isInitialized,
			toggleSongInPlaylist,
			isSongInPlaylist,
		}),
		[playlistSongs, isInitialized, toggleSongInPlaylist, isSongInPlaylist],
	);
}
