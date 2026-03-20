"use client";

import { useLocalStorage } from "./useLocalStorage";
import { useCallback, useMemo } from "react";

/**
 * Manages liked songs and library songs localStorage state.
 * Consolidates the repeated patterns from album, playlist, and liked pages.
 */
export function useSongActions() {
	const [likedSongs, setLikedSongs] = useLocalStorage<Record<string, boolean>>(
		"likedSongs",
		{},
	);
	const [librarySongs, setLibrarySongs] = useLocalStorage<
		Record<string, boolean>
	>("librarySongs", {});

	const [, , isInitializedLikes] = useLocalStorage("likedSongs", {});
	const [, , isInitializedSongs] = useLocalStorage("librarySongs", {});

	const isInitialized = isInitializedLikes && isInitializedSongs;

	const toggleLike = useCallback(
		(songKey: string) => {
			const newLikedState = !likedSongs[songKey];
			setLikedSongs({ ...likedSongs, [songKey]: newLikedState });
		},
		[likedSongs, setLikedSongs],
	);

	const toggleLibrary = useCallback(
		(songKey: string) => {
			const newLibraryState = !librarySongs[songKey];
			setLibrarySongs({ ...librarySongs, [songKey]: newLibraryState });
		},
		[librarySongs, setLibrarySongs],
	);

	const isLiked = useCallback(
		(songKey: string, defaultLiked: boolean) =>
			likedSongs[songKey] ?? defaultLiked,
		[likedSongs],
	);

	const isInLibrary = useCallback(
		(songKey: string) => librarySongs[songKey] ?? false,
		[librarySongs],
	);

	return useMemo(
		() => ({
			likedSongs,
			librarySongs,
			isInitialized,
			toggleLike,
			toggleLibrary,
			isLiked,
			isInLibrary,
		}),
		[
			likedSongs,
			librarySongs,
			isInitialized,
			toggleLike,
			toggleLibrary,
			isLiked,
			isInLibrary,
		],
	);
}
