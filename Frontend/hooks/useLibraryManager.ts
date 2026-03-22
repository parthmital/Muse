"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import { MediaItem } from "@/components/MediaCard";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useLibraryManager() {
	const { data: libraryData, mutate: mutateLibrary } = useSWR<{
		library: { itemType: string; itemId: string; isPinned: boolean }[];
	}>("http://localhost:8000/library", fetcher);

	const { data: playlistsData, mutate: mutatePlaylists } = useSWR<{
		playlists: { id: string; title: string; description?: string }[];
	}>("http://localhost:8000/playlists", fetcher);

	const libraryAlbums = useMemo(() => {
		const dict: Record<string, boolean> = {};
		libraryData?.library
			.filter((i) => i.itemType === "album")
			.forEach((i) => (dict[i.itemId] = true));
		return dict;
	}, [libraryData]);

	const libraryPlaylists = useMemo(() => {
		const dict: Record<string, boolean> = {};
		libraryData?.library
			.filter((i) => i.itemType === "playlist")
			.forEach((i) => (dict[i.itemId] = true));
		return dict;
	}, [libraryData]);

	const libraryArtists = useMemo(() => {
		const dict: Record<string, boolean> = {};
		libraryData?.library
			.filter((i) => i.itemType === "artist")
			.forEach((i) => (dict[i.itemId] = true));
		return dict;
	}, [libraryData]);

	const pinnedItems = useMemo(() => {
		const dict: Record<string, boolean> = {};
		libraryData?.library
			.filter((i) => i.isPinned)
			.forEach((i) => (dict[i.itemId] = true));
		return dict;
	}, [libraryData]);

	const customPlaylists = useMemo(() => {
		return (
			(playlistsData?.playlists.map((p) => ({
				title: p.title,
				type: "playlist",
				id: p.id,
			})) as MediaItem[]) || []
		);
	}, [playlistsData]);

	const isInitialized =
		libraryData !== undefined && playlistsData !== undefined;

	const toggleBackendItem = async (
		itemType: string,
		itemId: string,
		currentState: boolean,
	) => {
		if (currentState) {
			await fetch("http://localhost:8000/library", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ itemType, itemId }),
			});
		} else {
			await fetch("http://localhost:8000/library", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ itemType, itemId }),
			});
		}
		mutateLibrary();
	};

	const toggleAlbumInLibrary = useCallback(
		(title: string) =>
			toggleBackendItem("album", title, !!libraryAlbums[title]),
		[libraryAlbums, mutateLibrary],
	);

	const togglePlaylistInLibrary = useCallback(
		(title: string) =>
			toggleBackendItem("playlist", title, !!libraryPlaylists[title]),
		[libraryPlaylists, mutateLibrary],
	);

	const toggleArtistInLibrary = useCallback(
		(title: string) =>
			toggleBackendItem("artist", title, !!libraryArtists[title]),
		[libraryArtists, mutateLibrary],
	);

	const togglePin = useCallback(
		(title: string, currentState: boolean) => {
			// In a full impl this would toggle the isPinned in DB. For now it is just locally missing.
			// Add pinning endpoint to backend to fully support this.
		},
		[pinnedItems],
	);

	const addCustomPlaylist = useCallback(
		async (playlist: MediaItem) => {
			await fetch("http://localhost:8000/playlists", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: playlist.title }),
			});
			mutatePlaylists();
		},
		[mutatePlaylists],
	);

	const removeCustomPlaylist = useCallback(
		async (title: string) => {
			const playlist = playlistsData?.playlists.find((p) => p.title === title);
			if (!playlist) return;
			await fetch(`http://localhost:8000/playlists/${playlist.id}`, {
				method: "DELETE",
			});
			mutatePlaylists();
		},
		[playlistsData, mutatePlaylists],
	);

	const isInLibrary = useCallback(
		(item: MediaItem) => {
			const isCustom = customPlaylists.some((cp) => cp.title === item.title);
			if (isCustom) return true;
			if (item.type === "artist") return libraryArtists[item.title] ?? false;
			if (item.type === "album") return libraryAlbums[item.title] ?? false;
			if (item.type === "mix" || item.type === "playlist")
				return libraryPlaylists[item.title] ?? false;
			return false;
		},
		[customPlaylists, libraryArtists, libraryAlbums, libraryPlaylists],
	);

	return useMemo(
		() => ({
			libraryAlbums,
			libraryPlaylists,
			libraryArtists,
			pinnedItems,
			customPlaylists,
			isInitialized,
			toggleAlbumInLibrary,
			togglePlaylistInLibrary,
			toggleArtistInLibrary,
			togglePin,
			addCustomPlaylist,
			removeCustomPlaylist,
			isInLibrary,
		}),
		[
			libraryAlbums,
			libraryPlaylists,
			libraryArtists,
			pinnedItems,
			customPlaylists,
			isInitialized,
			toggleAlbumInLibrary,
			togglePlaylistInLibrary,
			toggleArtistInLibrary,
			togglePin,
			addCustomPlaylist,
			removeCustomPlaylist,
			isInLibrary,
		],
	);
}
