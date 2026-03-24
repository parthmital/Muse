"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import { API_BASE, swrFetcher } from "@/lib/api";

/**
 * Manages liked songs and library songs via SWR.
 */
export function useSongActions() {
	const { data: libraryData, mutate: mutateLibrary } = useSWR<{
		library: { itemType: string; itemId: string; isPinned: boolean }[];
	}>(`${API_BASE}/library`, swrFetcher);

	const isInitialized = libraryData !== undefined;

	const likedSongs = useMemo(() => {
		const dict: Record<string, boolean> = {};
		libraryData?.library
			.filter((i) => i.itemType === "liked_track")
			.forEach((i) => (dict[i.itemId] = true));
		return dict;
	}, [libraryData]);

	const librarySongs = useMemo(() => {
		const dict: Record<string, boolean> = {};
		libraryData?.library
			.filter((i) => i.itemType === "library_track")
			.forEach((i) => (dict[i.itemId] = true));
		return dict;
	}, [libraryData]);

	const toggleBackendItem = async (
		itemType: string,
		itemId: string,
		currentState: boolean,
	) => {
		if (currentState) {
			await fetch(`${API_BASE}/library`, {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ itemType, itemId }),
			});
		} else {
			await fetch(`${API_BASE}/library`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ itemType, itemId }),
			});
		}
		mutateLibrary();
	};

	const toggleLike = useCallback(
		(songKey: string) =>
			toggleBackendItem("liked_track", songKey, !!likedSongs[songKey]),
		[likedSongs, mutateLibrary],
	);

	const toggleLibrary = useCallback(
		(songKey: string) =>
			toggleBackendItem("library_track", songKey, !!librarySongs[songKey]),
		[librarySongs, mutateLibrary],
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
