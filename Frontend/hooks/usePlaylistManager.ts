"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function usePlaylistManager() {
	// This hook would ideally fetch ALL playlists and all tracks for them, or specifically tracks for an active playlist.
	// For now, we will just use a generic fetch per playlist id in another component, or an aggregated endpoint.
	// We'll mimic the legacy structure by tracking the state or re-fetching.

	// SWR with dynamic array of playlist names is tricky here if we don't know the IDs.
	// If a component needs a specific playlist, it should fetch `/playlists/:id/tracks`.

	// Provide mostly stable interface but note it should be used within a specific Playlist context.
	const { data, mutate } = useSWR<{
		playlists: { id: string; title: string }[];
	}>("http://localhost:8000/playlists", fetcher);

	const isInitialized = data !== undefined;

	// In a complete rewrite, the playlist component should directly use `fetch /playlists/:id/tracks`
	// Here we provide the legacy methods by doing lookups.
	const toggleSongInPlaylist = useCallback(
		async (playlistName: string, songKey: string) => {
			if (!data) return;
			const p = data.playlists.find(
				(p) => p.title === playlistName || p.id === playlistName,
			);
			if (!p) return;

			// Fetch current tracks to check if it's there
			const res = await fetch(`http://localhost:8000/playlists/${p.id}/tracks`);
			const tracksData = await res.json();
			const isIn = RegExp(songKey).test(JSON.stringify(tracksData));

			if (isIn) {
				await fetch(
					`http://localhost:8000/playlists/${p.id}/tracks/${songKey}`,
					{ method: "DELETE" },
				);
			} else {
				await fetch(`http://localhost:8000/playlists/${p.id}/tracks`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ trackId: songKey }),
				});
			}
			mutate();
		},
		[data, mutate],
	);

	// Since we don't preload all tracks natively without an aggressive backend query,
	// checking if a song is in playlist synchronously is impossible unless we fetch everything.
	// Ideally the caller uses a hook specific to that playlist.
	// We mock it for now since we moved to backend-synced storage.
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
			playlistSongs: {}, // Deprecated synchronous map
			isInitialized,
			toggleSongInPlaylist,
			isSongInPlaylist,
		}),
		[isInitialized, toggleSongInPlaylist, isSongInPlaylist],
	);
}
