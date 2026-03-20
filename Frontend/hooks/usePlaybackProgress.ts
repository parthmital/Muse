"use client";

import { useState, useEffect, useCallback } from "react";

export function usePlaybackProgress(
	initialDuration: number = 0,
	isPlaying: boolean = false,
) {
	const [progress, setProgress] = useState(0);
	const [duration, setDuration] = useState(initialDuration);
	const [isDragging, setIsDragging] = useState(false);

	useEffect(() => {
		if (isPlaying && !isDragging) {
			const interval = setInterval(() => {
				setProgress((prev) => (prev >= duration ? duration : prev + 1));
			}, 1000);
			return () => clearInterval(interval);
		}
	}, [isPlaying, isDragging, duration]);

	const handleSeek = useCallback((newProgress: number) => {
		setProgress(newProgress);
	}, []);

	return {
		progress,
		duration,
		setDuration,
		isDragging,
		setIsDragging,
		handleSeek,
		setProgress,
	};
}
