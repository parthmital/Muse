"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePlayer } from "@/context/PlayerContext";
import { useSongActions } from "@/hooks/useContextMenu";
import { useToast } from "@/context/ToastContext";
import { trackKey } from "@/lib/trackKey";

/**
 * Global keyboard shortcuts, matching the conventions of Spotify / Apple Music.
 * Mounted once near the root. No UI of its own.
 *
 *   Space            play / pause
 *   → / ←            seek ±5s
 *   Shift+→ / ←      next / previous track
 *   Ctrl/⌘ + ↑ / ↓   volume up / down
 *   M                mute / unmute
 *   S                shuffle      R  repeat
 *   L                like current track
 *   / or Ctrl/⌘ + K  focus search
 */
export function GlobalHotkeys() {
	const router = useRouter();
	const {
		currentTrack,
		togglePlay,
		seek,
		progress,
		duration,
		skipToNext,
		skipToPrev,
		toggleShuffle,
		toggleRepeat,
		volume,
		setVolume,
	} = usePlayer();
	const { toggleLike, isLiked } = useSongActions();
	const { toast } = useToast();

	// Keep latest values without re-binding the listener every render.
	const ref = useRef({
		currentTrack,
		togglePlay,
		seek,
		progress,
		duration,
		skipToNext,
		skipToPrev,
		toggleShuffle,
		toggleRepeat,
		volume,
		setVolume,
		toggleLike,
		isLiked,
		toast,
		router,
		lastVolume: volume || 0.7,
	});
	// Keep the latest values in the ref so the (stable) key handler always sees
	// fresh state. Updating a ref must happen outside render, hence the effect.
	useEffect(() => {
		ref.current = {
			...ref.current,
			currentTrack,
			togglePlay,
			seek,
			progress,
			duration,
			skipToNext,
			skipToPrev,
			toggleShuffle,
			toggleRepeat,
			volume,
			setVolume,
			toggleLike,
			isLiked,
			toast,
			router,
		};
	});

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			const tag = target?.tagName;
			const isTyping =
				tag === "INPUT" ||
				tag === "TEXTAREA" ||
				tag === "SELECT" ||
				target?.isContentEditable;

			const s = ref.current;
			const mod = e.ctrlKey || e.metaKey;

			// Search focus works even while not typing elsewhere.
			if (
				(e.key === "/" && !isTyping) ||
				(mod && e.key.toLowerCase() === "k")
			) {
				e.preventDefault();
				s.router.push("/search");
				return;
			}

			if (isTyping) return;

			switch (e.key) {
				case " ":
				case "Spacebar":
					if (s.currentTrack) {
						e.preventDefault();
						s.togglePlay();
					}
					return;
				case "ArrowRight":
					if (e.shiftKey) {
						e.preventDefault();
						s.skipToNext();
					} else if (s.duration) {
						e.preventDefault();
						s.seek(Math.min(s.duration, s.progress + 5));
					}
					return;
				case "ArrowLeft":
					if (e.shiftKey) {
						e.preventDefault();
						s.skipToPrev();
					} else if (s.duration) {
						e.preventDefault();
						s.seek(Math.max(0, s.progress - 5));
					}
					return;
				case "ArrowUp":
					if (mod) {
						e.preventDefault();
						s.setVolume(Math.min(1, Math.round((s.volume + 0.1) * 10) / 10));
					}
					return;
				case "ArrowDown":
					if (mod) {
						e.preventDefault();
						s.setVolume(Math.max(0, Math.round((s.volume - 0.1) * 10) / 10));
					}
					return;
			}

			switch (e.key.toLowerCase()) {
				case "m":
					if (s.volume > 0) {
						ref.current.lastVolume = s.volume;
						s.setVolume(0);
					} else {
						s.setVolume(ref.current.lastVolume || 0.7);
					}
					return;
				case "s":
					s.toggleShuffle();
					return;
				case "r":
					s.toggleRepeat();
					return;
				case "l": {
					if (!s.currentTrack) return;
					const key = trackKey(s.currentTrack);
					const wasLiked = s.isLiked(key, s.currentTrack.liked);
					s.toggleLike(key);
					s.toast({
						message: wasLiked
							? "Removed from Liked Songs"
							: "Added to Liked Songs",
						variant: "success",
					});
					return;
				}
			}
		};

		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, []);

	return null;
}
