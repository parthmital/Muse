"use client";

import React, {
	createContext,
	useContext,
	useState,
	useRef,
	useEffect,
} from "react";
import { Song } from "@/components/SongRow";

interface PlayerContextType {
	currentTrack: Song | null;
	isPlaying: boolean;
	progress: number;
	duration: number;
	volume: number;
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

	const audioRef = useRef<HTMLAudioElement | null>(null);

	useEffect(() => {
		audioRef.current = new Audio();

		const audio = audioRef.current;

		const handleTimeUpdate = () => {
			setProgress(audio.currentTime);
		};

		const handleLoadedMetadata = () => {
			setDuration(audio.duration);
		};

		const handleEnded = () => {
			setIsPlaying(false);
			setProgress(0);
		};

		audio.addEventListener("timeupdate", handleTimeUpdate);
		audio.addEventListener("loadedmetadata", handleLoadedMetadata);
		audio.addEventListener("ended", handleEnded);

		return () => {
			audio.removeEventListener("timeupdate", handleTimeUpdate);
			audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
			audio.removeEventListener("ended", handleEnded);
			audio.pause();
		};
	}, []);

	useEffect(() => {
		if (audioRef.current) {
			audioRef.current.volume = volume;
		}
	}, [volume]);

	const playTrack = (track: Song) => {
		if (!audioRef.current) return;

		// If same track, just toggle
		if (
			currentTrack?.title === track.title &&
			currentTrack?.artist === track.artist
		) {
			togglePlay();
			return;
		}

		setCurrentTrack(track);
		setIsPlaying(true);

		// For now, all songs play Damocles.m4a
		audioRef.current.src = "/music/Damocles.m4a";
		audioRef.current.play().catch((e) => console.error("Playback failed:", e));
	};

	const togglePlay = () => {
		if (!audioRef.current || !currentTrack) return;

		if (isPlaying) {
			audioRef.current.pause();
		} else {
			audioRef.current
				.play()
				.catch((e) => console.error("Playback failed:", e));
		}
		setIsPlaying(!isPlaying);
	};

	const seek = (time: number) => {
		if (!audioRef.current) return;
		audioRef.current.currentTime = time;
		setProgress(time);
	};

	const value = {
		currentTrack,
		isPlaying,
		progress,
		duration,
		volume,
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
