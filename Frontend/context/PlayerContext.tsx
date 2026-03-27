"use client";

import React, {
	createContext,
	useContext,
	useState,
	useRef,
	useEffect,
	useCallback,
} from "react";
import { Song } from "@/components/SongRow";
import { getStreamInfo } from "@/lib/api";
import type { MediaPlayerClass } from "dashjs";

interface PlayerContextType {
	currentTrack: Song | null;
	isPlaying: boolean;
	progress: number;
	duration: number;
	volume: number;
	audioQuality: string | null;
	isShuffled: boolean;
	repeatMode: "off" | "all" | "one";
	playTrack: (track: Song) => void;
	togglePlay: () => void;
	seek: (time: number) => void;
	setVolume: (volume: number) => void;
	addToQueue: (track: Song) => void;
	playNext: (track: Song) => void;
	playPlaylist: (tracks: Song[], startIdx?: number) => void;
	skipToNext: () => void;
	skipToPrev: () => void;
	toggleShuffle: () => void;
	toggleRepeat: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
	const [currentTrack, setCurrentTrack] = useState<Song | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [progress, setProgress] = useState(0);
	const [duration, setDuration] = useState(0);
	const [volume, setVolumeState] = useState(0.7);
	const [audioQuality, setAudioQuality] = useState<string | null>(null);
	const [queue, setQueue] = useState<Song[]>([]);
	const [currentIndex, setCurrentIndex] = useState(-1);
	const [isShuffled, setIsShuffled] = useState(false);
	const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");

	const queueRef = useRef<Song[]>([]);
	const indexRef = useRef(-1);
	const repeatRef = useRef<"off" | "all" | "one">("off");
	const shuffleRef = useRef(false);

	const audioRef = useRef<HTMLAudioElement | null>(null);
	const dashPlayerRef = useRef<MediaPlayerClass | null>(null);

	const playTrackInternal = useCallback(async (track: Song) => {
		if (!audioRef.current) return;

		setCurrentTrack(track);
		setIsPlaying(true);
		setProgress(0);
		setAudioQuality(null);

		try {
			let streamUrl = track.streamUrl;
			let manifestMimeType = "";
			let manifest = "";

			if (!streamUrl && track.tidalId) {
				const info = await getStreamInfo(track.tidalId);
				streamUrl = info.streamUrl ?? "";
				manifestMimeType = info.manifestMimeType;
				manifest = info.manifest;
				setAudioQuality(info.audioQuality);
			}

			const audio = audioRef.current;
			const dashPlayer = dashPlayerRef.current;

			// Reset dash player before loading new content
			if (dashPlayer) {
				try {
					dashPlayer.reset();
				} catch {
					// Ignore if not initialized
				}
			}

			if (
				manifestMimeType === "application/dash+xml" &&
				manifest &&
				dashPlayer
			) {
				const decoded = atob(manifest);
				const blob = new Blob([decoded], { type: "application/dash+xml" });
				const blobUrl = URL.createObjectURL(blob);
				dashPlayer.initialize(audio, blobUrl, true);
			} else if (streamUrl) {
				audio.src = streamUrl;
				audio.play().catch(console.error);
			} else {
				// No stream available — show error state instead of loading dummy file
				console.warn("No stream URL available for track:", track.title);
				setIsPlaying(false);
			}
		} catch (err) {
			console.error("Failed to load stream:", err);
			setIsPlaying(false);
		}
	}, []);

	const skipToNext = useCallback(() => {
		const q = queueRef.current;
		const idx = indexRef.current;

		if (q.length === 0) return;

		if (repeatRef.current === "one") {
			playTrackInternal(q[idx]);
			return;
		}

		if (idx < q.length - 1) {
			const nextIdx = idx + 1;
			indexRef.current = nextIdx;
			setCurrentIndex(nextIdx);
			playTrackInternal(q[nextIdx]);
		} else if (repeatRef.current === "all") {
			indexRef.current = 0;
			setCurrentIndex(0);
			playTrackInternal(q[0]);
		} else {
			setIsPlaying(false);
			setProgress(0);
		}
	}, [playTrackInternal]);

	const skipToPrev = useCallback(() => {
		const q = queueRef.current;
		const idx = indexRef.current;
		const audio = audioRef.current;

		// If more than 3 seconds in, restart current track
		if (audio && audio.currentTime > 3) {
			audio.currentTime = 0;
			setProgress(0);
			return;
		}

		if (idx > 0) {
			const prevIdx = idx - 1;
			indexRef.current = prevIdx;
			setCurrentIndex(prevIdx);
			playTrackInternal(q[prevIdx]);
		} else if (repeatRef.current === "all" && q.length > 0) {
			const lastIdx = q.length - 1;
			indexRef.current = lastIdx;
			setCurrentIndex(lastIdx);
			playTrackInternal(q[lastIdx]);
		}
	}, [playTrackInternal]);

	const toggleShuffle = useCallback(() => {
		setIsShuffled((prev) => {
			const next = !prev;
			shuffleRef.current = next;

			if (next && queueRef.current.length > 1) {
				// Shuffle queue but keep current track in place
				const current = queueRef.current[indexRef.current];
				const rest = queueRef.current.filter((_, i) => i !== indexRef.current);
				for (let i = rest.length - 1; i > 0; i--) {
					const j = Math.floor(Math.random() * (i + 1));
					[rest[i], rest[j]] = [rest[j], rest[i]];
				}
				const newQueue = [current, ...rest];
				queueRef.current = newQueue;
				indexRef.current = 0;
				setQueue(newQueue);
				setCurrentIndex(0);
			}

			return next;
		});
	}, []);

	const toggleRepeat = useCallback(() => {
		setRepeatMode((prev) => {
			const modes: ("off" | "all" | "one")[] = ["off", "all", "one"];
			const next = modes[(modes.indexOf(prev) + 1) % modes.length];
			repeatRef.current = next;
			return next;
		});
	}, []);

	useEffect(() => {
		audioRef.current = new Audio();
		const audio = audioRef.current;

		const handleTimeUpdate = () => setProgress(audio.currentTime);
		const handleLoadedMetadata = () => setDuration(audio.duration);
		const handleEnded = () => skipToNext();

		audio.addEventListener("timeupdate", handleTimeUpdate);
		audio.addEventListener("loadedmetadata", handleLoadedMetadata);
		audio.addEventListener("ended", handleEnded);

		import("dashjs").then((dashjs) => {
			dashPlayerRef.current = dashjs.MediaPlayer().create();
			dashPlayerRef.current.updateSettings({
				streaming: { buffer: { fastSwitchEnabled: true } },
			});
		});

		return () => {
			audio.removeEventListener("timeupdate", handleTimeUpdate);
			audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
			audio.removeEventListener("ended", handleEnded);
			audio.pause();
			if (dashPlayerRef.current) dashPlayerRef.current.destroy();
		};
	}, [skipToNext]);

	useEffect(() => {
		if (audioRef.current) audioRef.current.volume = volume;
	}, [volume]);

	const playTrack = useCallback(
		(track: Song) => {
			setQueue([track]);
			queueRef.current = [track];
			setCurrentIndex(0);
			indexRef.current = 0;
			playTrackInternal(track);
		},
		[playTrackInternal],
	);

	const playPlaylist = useCallback(
		(tracks: Song[], startIdx = 0) => {
			if (tracks.length === 0) return;
			setQueue(tracks);
			queueRef.current = tracks;
			setCurrentIndex(startIdx);
			indexRef.current = startIdx;
			playTrackInternal(tracks[startIdx]);
		},
		[playTrackInternal],
	);

	const addToQueue = useCallback((track: Song) => {
		setQueue((prev) => {
			const next = [...prev, track];
			queueRef.current = next;
			return next;
		});
	}, []);

	const playNextFn = useCallback((track: Song) => {
		setQueue((prev) => {
			const next = [...prev];
			next.splice(indexRef.current + 1, 0, track);
			queueRef.current = next;
			return next;
		});
	}, []);

	const togglePlay = useCallback(() => {
		if (!audioRef.current || !currentTrack) return;
		if (isPlaying) {
			audioRef.current.pause();
		} else {
			audioRef.current.play().catch(console.error);
		}
		setIsPlaying(!isPlaying);
	}, [isPlaying, currentTrack]);

	const seek = useCallback((time: number) => {
		if (!audioRef.current) return;
		audioRef.current.currentTime = time;
		setProgress(time);
	}, []);

	const setVolume = useCallback((vol: number) => {
		setVolumeState(vol);
	}, []);

	const value = {
		currentTrack,
		isPlaying,
		progress,
		duration,
		volume,
		audioQuality,
		isShuffled,
		repeatMode,
		playTrack,
		togglePlay,
		seek,
		setVolume,
		addToQueue,
		playNext: playNextFn,
		playPlaylist,
		skipToNext,
		skipToPrev,
		toggleShuffle,
		toggleRepeat,
	};

	return (
		<PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
	);
}

export function usePlayer() {
	const context = useContext(PlayerContext);
	if (context === undefined) {
		throw new Error("usePlayer must be used within a PlayerProvider");
	}
	return context;
}
