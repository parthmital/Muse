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
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
	const [currentTrack, setCurrentTrack] = useState<Song | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [progress, setProgress] = useState(0);
	const [duration, setDuration] = useState(0);
	const [volume, setVolume] = useState(0.7);
	const [audioQuality, setAudioQuality] = useState<string | null>(null);

	const audioRef = useRef<HTMLAudioElement | null>(null);
	const dashPlayerRef = useRef<MediaPlayerClass | null>(null);

	useEffect(() => {
		audioRef.current = new Audio();
		const audio = audioRef.current;

		const handleTimeUpdate = () => setProgress(audio.currentTime);
		const handleLoadedMetadata = () => setDuration(audio.duration);
		const handleEnded = () => {
			setIsPlaying(false);
			setProgress(0);
		};

		audio.addEventListener("timeupdate", handleTimeUpdate);
		audio.addEventListener("loadedmetadata", handleLoadedMetadata);
		audio.addEventListener("ended", handleEnded);

		// Initialize dash.js
		import("dashjs").then((dashjs) => {
			dashPlayerRef.current = dashjs.MediaPlayer().create();
			dashPlayerRef.current.updateSettings({
				streaming: {
					buffer: { fastSwitchEnabled: true },
				},
			});
		});

		return () => {
			audio.removeEventListener("timeupdate", handleTimeUpdate);
			audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
			audio.removeEventListener("ended", handleEnded);
			audio.pause();
			if (dashPlayerRef.current) {
				dashPlayerRef.current.destroy();
			}
		};
	}, []);

	useEffect(() => {
		if (audioRef.current) {
			audioRef.current.volume = volume;
		}
	}, [volume]);

	const playTrack = useCallback(
		async (track: Song) => {
			if (!audioRef.current) return;

			// If same track, just toggle
			if (
				currentTrack?.title === track.title &&
				currentTrack?.artist === track.artist
			) {
				if (isPlaying) {
					audioRef.current.pause();
					setIsPlaying(false);
				} else {
					audioRef.current.play().catch(console.error);
					setIsPlaying(true);
				}
				return;
			}

			setCurrentTrack(track);
			setIsPlaying(true);
			setProgress(0);

			try {
				let streamUrl = track.streamUrl;
				let manifestMimeType = "";
				let manifest = "";

				if (!streamUrl && track.tidalId) {
					const info = await getStreamInfo(track.tidalId, "HI_RES_LOSSLESS");
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
					// Use dash.js for Lossless/Hi-Res
					const decoded = atob(manifest);
					const blob = new Blob([decoded], { type: "application/dash+xml" });
					const blobUrl = URL.createObjectURL(blob);
					dashPlayer.initialize(audio, blobUrl, true);
				} else if (streamUrl) {
					// Standard progressive download (BTS/MP3)
					if (dashPlayer) dashPlayer.reset();
					audio.src = streamUrl;
					audio.play().catch(console.error);
				} else {
					// Fallback
					audio.src = "/music/Damocles.m4a";
					audio.play().catch(console.error);
				}
			} catch (err) {
				console.error("Failed to load stream:", err);
			}
		},
		[currentTrack, isPlaying],
	);

	const togglePlay = useCallback(() => {
		if (!audioRef.current || !currentTrack) return;

		if (isPlaying) {
			audioRef.current.pause();
		} else {
			audioRef.current
				.play()
				.catch((e) => console.error("Playback failed:", e));
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
