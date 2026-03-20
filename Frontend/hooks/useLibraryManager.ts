"use client";

import { useLocalStorage } from "./useLocalStorage";
import { useCallback, useMemo } from "react";
import { MediaItem } from "@/components/MediaCard";

export function useLibraryManager() {
	const [libraryAlbums, setLibraryAlbums, isInitializedAlbums] =
		useLocalStorage<Record<string, boolean>>("libraryAlbums", {});
	const [libraryPlaylists, setLibraryPlaylists, isInitializedPlaylists] =
		useLocalStorage<Record<string, boolean>>("libraryPlaylists", {});
	const [libraryArtists, setLibraryArtists, isInitializedArtists] =
		useLocalStorage<Record<string, boolean>>("libraryArtists", {});
	const [pinnedItems, setPinnedItems, isInitializedPins] = useLocalStorage<
		Record<string, boolean>
	>("pinnedLibraryItems", {});
	const [customPlaylists, setCustomPlaylists, isInitializedCustom] =
		useLocalStorage<MediaItem[]>("customPlaylists", []);

	const isInitialized =
		isInitializedAlbums &&
		isInitializedPlaylists &&
		isInitializedArtists &&
		isInitializedPins &&
		isInitializedCustom;

	const toggleAlbumInLibrary = useCallback(
		(title: string) => {
			setLibraryAlbums({
				...libraryAlbums,
				[title]: !libraryAlbums[title],
			});
		},
		[libraryAlbums, setLibraryAlbums],
	);

	const togglePlaylistInLibrary = useCallback(
		(title: string) => {
			setLibraryPlaylists({
				...libraryPlaylists,
				[title]: !libraryPlaylists[title],
			});
		},
		[libraryPlaylists, setLibraryPlaylists],
	);

	const toggleArtistInLibrary = useCallback(
		(title: string) => {
			setLibraryArtists({
				...libraryArtists,
				[title]: !libraryArtists[title],
			});
		},
		[libraryArtists, setLibraryArtists],
	);

	const togglePin = useCallback(
		(title: string, currentState: boolean) => {
			setPinnedItems({
				...pinnedItems,
				[title]: !currentState,
			});
		},
		[pinnedItems, setPinnedItems],
	);

	const addCustomPlaylist = useCallback(
		(playlist: MediaItem) => {
			setCustomPlaylists([...customPlaylists, playlist]);
		},
		[customPlaylists, setCustomPlaylists],
	);

	const removeCustomPlaylist = useCallback(
		(title: string) => {
			setCustomPlaylists(customPlaylists.filter((cp) => cp.title !== title));
		},
		[customPlaylists, setCustomPlaylists],
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
