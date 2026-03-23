"use client";

import { useState, useCallback } from "react";

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
				const API_BASE =
					process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
				const res = await fetch(
					`${API_BASE}/context-menu/${type}/${id}?userId=${userId}`,
				);
				const data = await res.json();
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

	const getMenuItems = (type: string, data: ContextMenuState | null) => {
		if (!data) return [];
		const { inLibrary, isPinned } = data;

		const menu: ContextMenuItem[] = [];

		// Playback Actions
		if (["track", "album", "playlist", "mix", "user_playlist"].includes(type)) {
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
			menu.push({ label: "Track info", action: "track_info", icon: "Info" });
		}
		return menu;
	};

	const executeAction = useCallback(
		async (
			action: string,
			type: string,
			id: string,
			userId: string,
			target?: string,
		) => {
			try {
				const API_BASE =
					process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
				const res = await fetch(`${API_BASE}/actions/${action}`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ userId, type, id, target }),
				});
				const data = await res.json();
				return data;
			} catch (err) {
				console.error(`Failed to execute action ${action}:`, err);
				return { success: false };
			}
		},
		[],
	);

	return { state, loading, fetchMenu, executeAction, getMenuItems };
}
