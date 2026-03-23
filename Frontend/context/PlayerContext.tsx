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
	playTrack: (track: Song) => void;
	togglePlay: () => void;
	seek: (time: number) => void;
	setVolume: (volume: number) => void;
	addToQueue: (track: Song) => void;
	playNext: (track: Song) => void;
	playPlaylist: (tracks: Song[], startIdx?: number) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
	const [currentTrack, setCurrentTrack] = useState<Song | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [progress, setProgress] = useState(0);
	const [duration, setDuration] = useState(0);
	const [volume, setVolume] = useState(0.7);
	const [audioQuality, setAudioQuality] = useState<string | null>(null);
	const [queue, setQueue] = useState<Song[]>([]);
	const [currentIndex, setCurrentIndex] = useState(-1);

	const queueRef = useRef<Song[]>([]);
	const indexRef = useRef(-1);

	const audioRef = useRef<HTMLAudioElement | null>(null);
	const dashPlayerRef = useRef<MediaPlayerClass | null>(null);

	const playTrackInternal = useCallback(async (track: Song) => {
		if (!audioRef.current) return;

		setCurrentTrack(track);
		setIsPlaying(true);
		setProgress(0);

		try {
			let streamUrl = track.streamUrl;
			let manifestMimeType = "";
			let manifest = "";

			if (!streamUrl && track.tidalId) {
				const info = await getStreamInfo(track.tidalId, "LOSSLESS");
				streamUrl = info.streamUrl ?? "";
				manifestMimeType = info.manifestMimeType;
				manifest = info.manifest;
				setAudioQuality(info.audioQuality);
			}

			const audio = audioRef.current;
			const dashPlayer = dashPlayerRef.current;

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
				if (dashPlayer) {
					try {
						dashPlayer.reset();
					} catch (e) {
						// Ignore if not initialized
					}
				}
				audio.src = streamUrl;
				audio.play().catch(console.error);
			} else {
				// Dummy fallback
				audio.src = "/music/Damocles.m4a";
				audio.play().catch(console.error);
			}
		} catch (err) {
			console.error("Failed to load stream:", err);
		}
	}, []);

	const skipToNext = useCallback(() => {
		if (indexRef.current < queueRef.current.length - 1) {
			const nextIdx = indexRef.current + 1;
			indexRef.current = nextIdx;
			setCurrentIndex(nextIdx);
			playTrackInternal(queueRef.current[nextIdx]);
		}
	}, [playTrackInternal]);

	useEffect(() => {
		audioRef.current = new Audio();
		const audio = audioRef.current;

		const handleTimeUpdate = () => setProgress(audio.currentTime);
		const handleLoadedMetadata = () => setDuration(audio.duration);
		const handleEnded = () => {
			if (indexRef.current < queueRef.current.length - 1) {
				skipToNext();
			} else {
				setIsPlaying(false);
				setProgress(0);
			}
		};

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

	const playNext = useCallback((track: Song) => {
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

	const value = {
		currentTrack,
		isPlaying,
		progress,
		duration,
		volume,
		audioQuality,
		playTrack,
		togglePlay,
		seek,
		setVolume,
		addToQueue,
		playNext,
		playPlaylist,
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
