"use client";

import React, {
	createContext,
	useContext,
	useState,
	useRef,
	useEffect,
	useCallback,
	useMemo,
} from "react";
import { Song } from "@/components/SongRow";
import { getStreamInfo, type StreamInfo } from "@/lib/api";
import type { MediaPlayerClass } from "dashjs";

interface PlayerContextType {
	currentTrack: Song | null;
	queue: Song[];
	currentIndex: number;
	isPlaying: boolean;
	progress: number;
	duration: number;
	volume: number;
	audioQuality: string | null;
	isShuffled: boolean;
	repeatMode: "off" | "all" | "one";
	smoothTransitions: boolean;
	normalizeVolume: boolean;
	playTrack: (track: Song) => void;
	togglePlay: () => void;
	seek: (time: number) => void;
	setVolume: (volume: number) => void;
	addToQueue: (track: Song) => void;
	playNext: (track: Song) => void;
	playPlaylist: (tracks: Song[], startIdx?: number) => void;
	playFromQueue: (index: number) => void;
	removeFromQueue: (index: number) => void;
	moveInQueue: (from: number, to: number) => void;
	skipToNext: () => void;
	skipToPrev: () => void;
	toggleShuffle: () => void;
	toggleRepeat: () => void;
	setSmoothTransitions: (enabled: boolean) => void;
	setNormalizeVolume: (enabled: boolean) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const FADE_OUT_SEC = 1.4;
const FADE_IN_SEC = 0.35;
const PREFETCH_CACHE_LIMIT = 12;

function readFlag(key: string, fallback: boolean): boolean {
	if (typeof window === "undefined") return fallback;
	const v = window.localStorage.getItem(key);
	return v === null ? fallback : v === "true";
}

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
	const [smoothTransitions, setSmoothTransitionsState] = useState(true);
	const [normalizeVolume, setNormalizeVolumeState] = useState(true);

	const queueRef = useRef<Song[]>([]);
	const indexRef = useRef(-1);
	const repeatRef = useRef<"off" | "all" | "one">("off");
	const shuffleRef = useRef(false);
	const smoothRef = useRef(true);
	const normalizeRef = useRef(true);

	const audioRef = useRef<HTMLAudioElement | null>(null);
	const dashPlayerRef = useRef<MediaPlayerClass | null>(null);
	const progressRafRef = useRef<number | null>(null);
	const blobUrlRef = useRef<string | null>(null);
	const latestTimeRef = useRef(0);
	const fadingOutRef = useRef(false);

	// Stream prefetch cache (next-track gapless), keyed by tidalId.
	const prefetchRef = useRef<Map<number, StreamInfo>>(new Map());

	// Web Audio graph for fade transitions + loudness leveling.
	const audioCtxRef = useRef<AudioContext | null>(null);
	const fadeGainRef = useRef<GainNode | null>(null);
	const compressorRef = useRef<DynamicsCompressorNode | null>(null);

	// Initialise toggles from localStorage on mount (client only).
	useEffect(() => {
		const smooth = readFlag("muse-smooth-transitions", true);
		const norm = readFlag("muse-normalize-volume", true);
		smoothRef.current = smooth;
		normalizeRef.current = norm;
		setSmoothTransitionsState(smooth);
		setNormalizeVolumeState(norm);
	}, []);

	const ensureAudioGraph = useCallback(() => {
		if (audioCtxRef.current || !audioRef.current) return;
		try {
			const Ctx =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext })
					.webkitAudioContext;
			if (!Ctx) return;
			const ctx = new Ctx();
			const source = ctx.createMediaElementSource(audioRef.current);
			const compressor = ctx.createDynamicsCompressor();
			// Gentle leveling/limiter — evens out loud masters without pumping.
			compressor.threshold.value = normalizeRef.current ? -24 : 0;
			compressor.knee.value = 30;
			compressor.ratio.value = normalizeRef.current ? 3 : 1;
			compressor.attack.value = 0.01;
			compressor.release.value = 0.25;
			const fadeGain = ctx.createGain();
			fadeGain.gain.value = 1;
			source.connect(compressor);
			compressor.connect(fadeGain);
			fadeGain.connect(ctx.destination);
			audioCtxRef.current = ctx;
			compressorRef.current = compressor;
			fadeGainRef.current = fadeGain;
		} catch {
			// Web Audio unavailable — playback still works through the element directly.
		}
	}, []);

	const rampFadeIn = useCallback(() => {
		const ctx = audioCtxRef.current;
		const gain = fadeGainRef.current;
		if (!ctx || !gain) return;
		const now = ctx.currentTime;
		gain.gain.cancelScheduledValues(now);
		if (smoothRef.current) {
			gain.gain.setValueAtTime(0.0001, now);
			gain.gain.linearRampToValueAtTime(1, now + FADE_IN_SEC);
		} else {
			gain.gain.setValueAtTime(1, now);
		}
	}, []);

	const prefetchNext = useCallback(() => {
		const q = queueRef.current;
		const next = q[indexRef.current + 1];
		if (!next?.tidalId) return;
		if (prefetchRef.current.has(next.tidalId)) return;
		getStreamInfo(next.tidalId)
			.then((info) => {
				if (prefetchRef.current.size >= PREFETCH_CACHE_LIMIT) {
					const oldest = prefetchRef.current.keys().next().value;
					if (oldest !== undefined) prefetchRef.current.delete(oldest);
				}
				prefetchRef.current.set(next.tidalId!, info);
			})
			.catch(() => {});
	}, []);

	const playTrackInternal = useCallback(
		async (track: Song) => {
			if (!audioRef.current) return;

			setCurrentTrack(track);
			setIsPlaying(true);
			setProgress(0);
			setAudioQuality(null);
			fadingOutRef.current = false;

			try {
				ensureAudioGraph();
				if (audioCtxRef.current?.state === "suspended") {
					audioCtxRef.current.resume().catch(() => {});
				}

				let streamUrl = track.streamUrl;
				let manifestMimeType = "";
				let manifest = "";

				if (!streamUrl && track.tidalId) {
					const cached = prefetchRef.current.get(track.tidalId);
					const info = cached ?? (await getStreamInfo(track.tidalId));
					if (cached) prefetchRef.current.delete(track.tidalId);
					streamUrl = info.streamUrl ?? "";
					manifestMimeType = info.manifestMimeType;
					manifest = info.manifest;
					setAudioQuality(info.audioQuality);
				}

				const audio = audioRef.current;
				const dashPlayer = dashPlayerRef.current;

				if (dashPlayer) {
					try {
						dashPlayer.reset();
					} catch {
						// Ignore if not initialized
					}
				}

				rampFadeIn();

				if (
					manifestMimeType === "application/dash+xml" &&
					manifest &&
					dashPlayer
				) {
					if (blobUrlRef.current) {
						URL.revokeObjectURL(blobUrlRef.current);
						blobUrlRef.current = null;
					}
					const decoded = atob(manifest);
					const blob = new Blob([decoded], { type: "application/dash+xml" });
					const blobUrl = URL.createObjectURL(blob);
					blobUrlRef.current = blobUrl;
					dashPlayer.initialize(audio, blobUrl, true);
				} else if (streamUrl) {
					audio.src = streamUrl;
					audio.play().catch(console.error);
				} else {
					console.warn("No stream URL available for track:", track.title);
					setIsPlaying(false);
				}

				// Warm the next track so transitions feel gapless.
				prefetchNext();
			} catch (err) {
				console.error("Failed to load stream:", err);
				setIsPlaying(false);
			}
		},
		[ensureAudioGraph, rampFadeIn, prefetchNext],
	);

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
		audioRef.current.crossOrigin = "anonymous";
		const audio = audioRef.current;

		const handleTimeUpdate = () => {
			latestTimeRef.current = audio.currentTime;

			// Fade-out near the end for smooth transitions.
			if (
				smoothRef.current &&
				!fadingOutRef.current &&
				audio.duration &&
				repeatRef.current !== "one" &&
				audio.duration - audio.currentTime <= FADE_OUT_SEC
			) {
				fadingOutRef.current = true;
				const ctx = audioCtxRef.current;
				const gain = fadeGainRef.current;
				if (ctx && gain) {
					const now = ctx.currentTime;
					const remaining = Math.max(0.1, audio.duration - audio.currentTime);
					gain.gain.cancelScheduledValues(now);
					gain.gain.setValueAtTime(gain.gain.value, now);
					gain.gain.linearRampToValueAtTime(0.0001, now + remaining);
				}
			}

			if (progressRafRef.current !== null) return;
			progressRafRef.current = window.requestAnimationFrame(() => {
				progressRafRef.current = null;
				setProgress(latestTimeRef.current);
			});
		};
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
			if (progressRafRef.current !== null) {
				window.cancelAnimationFrame(progressRafRef.current);
				progressRafRef.current = null;
			}
			if (blobUrlRef.current) {
				URL.revokeObjectURL(blobUrlRef.current);
				blobUrlRef.current = null;
			}
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

	const playFromQueue = useCallback(
		(index: number) => {
			const q = queueRef.current;
			if (index < 0 || index >= q.length) return;
			indexRef.current = index;
			setCurrentIndex(index);
			playTrackInternal(q[index]);
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

	const playNextFn = useCallback(
		(track: Song) => {
			setQueue((prev) => {
				const next = [...prev];
				next.splice(indexRef.current + 1, 0, track);
				queueRef.current = next;
				return next;
			});
			// A new "next" track invalidates the prefetch for the old next slot.
			prefetchNext();
		},
		[prefetchNext],
	);

	const removeFromQueue = useCallback((index: number) => {
		setQueue((prev) => {
			if (index < 0 || index >= prev.length || index === indexRef.current) {
				return prev;
			}
			const next = prev.filter((_, i) => i !== index);
			if (index < indexRef.current) {
				indexRef.current -= 1;
				setCurrentIndex(indexRef.current);
			}
			queueRef.current = next;
			return next;
		});
	}, []);

	const moveInQueue = useCallback((from: number, to: number) => {
		setQueue((prev) => {
			if (
				from < 0 ||
				to < 0 ||
				from >= prev.length ||
				to >= prev.length ||
				from === to
			) {
				return prev;
			}
			const next = [...prev];
			const [moved] = next.splice(from, 1);
			next.splice(to, 0, moved);

			// Keep the pointer on the currently-playing track.
			const cur = indexRef.current;
			let newCur = cur;
			if (from === cur) newCur = to;
			else if (from < cur && to >= cur) newCur = cur - 1;
			else if (from > cur && to <= cur) newCur = cur + 1;
			indexRef.current = newCur;
			setCurrentIndex(newCur);

			queueRef.current = next;
			return next;
		});
	}, []);

	const togglePlay = useCallback(() => {
		if (!audioRef.current || !currentTrack) return;
		if (isPlaying) {
			audioRef.current.pause();
		} else {
			if (audioCtxRef.current?.state === "suspended") {
				audioCtxRef.current.resume().catch(() => {});
			}
			audioRef.current.play().catch(console.error);
		}
		setIsPlaying(!isPlaying);
	}, [isPlaying, currentTrack]);

	const seek = useCallback((time: number) => {
		if (!audioRef.current) return;
		audioRef.current.currentTime = time;
		setProgress(time);
		// Seeking backwards out of the fade-out zone should cancel the fade.
		if (
			audioRef.current.duration &&
			audioRef.current.duration - time > FADE_OUT_SEC &&
			fadingOutRef.current
		) {
			fadingOutRef.current = false;
			const ctx = audioCtxRef.current;
			const gain = fadeGainRef.current;
			if (ctx && gain) {
				gain.gain.cancelScheduledValues(ctx.currentTime);
				gain.gain.setValueAtTime(1, ctx.currentTime);
			}
		}
	}, []);

	const setVolume = useCallback((vol: number) => {
		setVolumeState(vol);
	}, []);

	const setSmoothTransitions = useCallback((enabled: boolean) => {
		smoothRef.current = enabled;
		setSmoothTransitionsState(enabled);
		if (typeof window !== "undefined") {
			window.localStorage.setItem("muse-smooth-transitions", String(enabled));
		}
	}, []);

	const setNormalizeVolume = useCallback((enabled: boolean) => {
		normalizeRef.current = enabled;
		setNormalizeVolumeState(enabled);
		if (typeof window !== "undefined") {
			window.localStorage.setItem("muse-normalize-volume", String(enabled));
		}
		const comp = compressorRef.current;
		const ctx = audioCtxRef.current;
		if (comp && ctx) {
			comp.threshold.setValueAtTime(enabled ? -24 : 0, ctx.currentTime);
			comp.ratio.setValueAtTime(enabled ? 3 : 1, ctx.currentTime);
		}
	}, []);

	const value = useMemo(
		() => ({
			currentTrack,
			queue,
			currentIndex,
			isPlaying,
			progress,
			duration,
			volume,
			audioQuality,
			isShuffled,
			repeatMode,
			smoothTransitions,
			normalizeVolume,
			playTrack,
			togglePlay,
			seek,
			setVolume,
			addToQueue,
			playNext: playNextFn,
			playPlaylist,
			playFromQueue,
			removeFromQueue,
			moveInQueue,
			skipToNext,
			skipToPrev,
			toggleShuffle,
			toggleRepeat,
			setSmoothTransitions,
			setNormalizeVolume,
		}),
		[
			currentTrack,
			queue,
			currentIndex,
			isPlaying,
			progress,
			duration,
			volume,
			audioQuality,
			isShuffled,
			repeatMode,
			smoothTransitions,
			normalizeVolume,
			playTrack,
			togglePlay,
			seek,
			setVolume,
			addToQueue,
			playNextFn,
			playPlaylist,
			playFromQueue,
			removeFromQueue,
			moveInQueue,
			skipToNext,
			skipToPrev,
			toggleShuffle,
			toggleRepeat,
			setSmoothTransitions,
			setNormalizeVolume,
		],
	);

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
