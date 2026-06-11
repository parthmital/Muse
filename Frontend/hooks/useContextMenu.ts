"use client";

import useSWR from "swr";
import { useState, useCallback, useMemo } from "react";
import {
	getContextMenuState,
	executeAction as apiExecuteAction,
	addToLibrary,
	removeFromLibrary,
	API_BASE,
	swrFetcher,
} from "@/lib/api";

export interface ContextMenuItem {
	label: string;
	action: string;
	icon?: string;
	active?: boolean;
	target?: string;
}

export interface ContextMenuState {
	inLibrary: boolean;
	isPinned: boolean;
}

export function useContextMenu() {
	const [state, setState] = useState<ContextMenuState | null>(null);
	const [loading, setLoading] = useState(false);

	const fetchMenu = useCallback(
		async (type: string, id: string, userId: string) => {
			setLoading(true);
			try {
				const data = await getContextMenuState(type, id, userId);
				setState(data);
			} catch (err) {
				console.error("Failed to fetch context menu state:", err);
				setState(null);
			} finally {
				setLoading(false);
			}
		},
		[],
	);

	const getMenuItems = useCallback(
		(type: string, data: ContextMenuState | null) => {
			// Use default values when data is not available
			const inLibrary = data?.inLibrary ?? false;
			const isPinned = data?.isPinned ?? false;

			const menu: ContextMenuItem[] = [];

			// Playback Actions
			if (
				["track", "album", "playlist", "mix", "user_playlist"].includes(type)
			) {
				menu.push({
					label: "Shuffle play",
					action: "shuffle_play",
					icon: "Shuffle",
				});
			}
			if (type === "track" || type === "video" || type === "album") {
				menu.push({ label: "Start mix", action: "mix", icon: "Discover" });
			}
			menu.push({ label: "Play next", action: "play_next", icon: "Next" });
			menu.push({
				label: "Add to queue",
				action: "add_to_queue",
				icon: "Add",
			});

			// Library Actions
			if (["track", "video", "artist", "mix"].includes(type)) {
				menu.push({
					label: inLibrary ? "Unlike" : "Like",
					action: "toggle_like",
					icon: "Like",
					active: inLibrary,
				});
			} else {
				menu.push({
					label: inLibrary ? "Remove from library" : "Save to library",
					action: "toggle_library",
					icon: inLibrary ? "Check" : "Add",
					active: inLibrary,
				});
			}

			if (["album", "artist", "playlist", "user_playlist"].includes(type)) {
				menu.push({
					label: isPinned ? "Unpin" : "Pin",
					action: "toggle_pin",
					icon: "Pin",
					active: isPinned,
				});
			}

			if (type === "track" || type === "video") {
				menu.push({
					label: "Add to playlist",
					action: "add_to_playlist",
					icon: "Add to Playlist",
				});
			}

			// Navigation Actions
			if (["track", "video", "album"].includes(type)) {
				menu.push({
					label: "Go to artist",
					action: "navigate",
					target: "artist",
					icon: "Artist",
				});
			}
			if (["track", "video"].includes(type)) {
				menu.push({
					label: "Go to album",
					action: "navigate",
					target: "album",
					icon: "Album",
				});
			}

			// System Actions
			if (type === "track" || type === "video") {
				menu.push({
					label: "Track info",
					action: "track_info",
					icon: "Info",
				});
			}
			return menu;
		},
		[],
	);

	const executeAction = useCallback(
		async (
			action: string,
			type: string,
			id: string,
			userId: string,
			target?: string,
		) => {
			try {
				return await apiExecuteAction(action, type, id, userId, target);
			} catch (err) {
				console.error(`Failed to execute action ${action}:`, err);
				return { success: false };
			}
		},
		[],
	);

	return { state, loading, fetchMenu, executeAction, getMenuItems };
}

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
		type Lib = {
			library: { itemType: string; itemId: string; isPinned: boolean }[];
		};
		const optimisticData = (current?: Lib): Lib => {
			const lib = current?.library ?? [];
			if (currentState) {
				return {
					library: lib.filter(
						(i) => !(i.itemType === itemType && i.itemId === itemId),
					),
				};
			}
			return { library: [...lib, { itemType, itemId, isPinned: false }] };
		};

		// Optimistic: flip the UI immediately, roll back if the request fails.
		await mutateLibrary(
			(async (): Promise<Lib | undefined> => {
				if (currentState) {
					await removeFromLibrary(itemType, itemId);
				} else {
					await addToLibrary(itemType, itemId);
				}
				return undefined;
			})(),
			{
				optimisticData,
				rollbackOnError: true,
				revalidate: true,
				populateCache: false,
			},
		);
	};

	const toggleLike = useCallback(
		(songKey: string) =>
			toggleBackendItem("liked_track", songKey, !!likedSongs[songKey]),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[likedSongs, mutateLibrary],
	);

	const toggleLibrary = useCallback(
		(songKey: string) =>
			toggleBackendItem("library_track", songKey, !!librarySongs[songKey]),
		// eslint-disable-next-line react-hooks/exhaustive-deps
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
