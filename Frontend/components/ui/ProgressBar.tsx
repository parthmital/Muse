"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatPlaybackTime } from "@/utils/duration";

interface ProgressBarProps {
	progress: number;
	duration: number;
	onSeek: (time: number) => void;
	showTimes?: boolean;
	className?: string;
}

/**
 * Draggable seek bar shared by the Player bar and the Now Playing view.
 * Keyboard accessible (arrow keys seek ±5s when focused).
 */
export function ProgressBar({
	progress,
	duration,
	onSeek,
	showTimes = true,
	className = "",
}: ProgressBarProps) {
	const [isDragging, setIsDragging] = useState(false);
	const [dragProgress, setDragProgress] = useState(0);
	const barRef = useRef<HTMLDivElement>(null);

	const displayProgress = isDragging ? dragProgress : progress;
	const percent = duration ? (displayProgress / duration) * 100 : 0;

	const positionToTime = useCallback(
		(clientX: number) => {
			if (!barRef.current || !duration) return 0;
			const rect = barRef.current.getBoundingClientRect();
			const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
			return (x / rect.width) * duration;
		},
		[duration],
	);

	const handleMouseDown = (e: React.MouseEvent) => {
		if (!duration) return;
		setIsDragging(true);
		setDragProgress(positionToTime(e.clientX));
	};

	useEffect(() => {
		if (!isDragging) return;
		const move = (e: MouseEvent) => setDragProgress(positionToTime(e.clientX));
		const up = (e: MouseEvent) => {
			onSeek(positionToTime(e.clientX));
			setIsDragging(false);
		};
		window.addEventListener("mousemove", move);
		window.addEventListener("mouseup", up);
		return () => {
			window.removeEventListener("mousemove", move);
			window.removeEventListener("mouseup", up);
		};
	}, [isDragging, positionToTime, onSeek]);

	return (
		<div className={`flex items-center gap-3 ${className}`}>
			{showTimes && (
				<span className="min-w-9 text-right text-xs text-neutral-400 tabular-nums">
					{formatPlaybackTime(displayProgress)}
				</span>
			)}
			<div
				ref={barRef}
				role="slider"
				aria-label="Seek"
				aria-valuemin={0}
				aria-valuemax={Math.round(duration)}
				aria-valuenow={Math.round(displayProgress)}
				tabIndex={0}
				onMouseDown={handleMouseDown}
				onKeyDown={(e) => {
					if (!duration) return;
					if (e.key === "ArrowRight") {
						e.preventDefault();
						onSeek(Math.min(duration, progress + 5));
					} else if (e.key === "ArrowLeft") {
						e.preventDefault();
						onSeek(Math.max(0, progress - 5));
					}
				}}
				className="group relative h-2 grow cursor-pointer rounded-full bg-neutral-700"
			>
				<div
					className="absolute h-full rounded-full bg-white"
					style={{ width: `${percent}%` }}
				/>
				<div
					className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
					style={{ left: `${percent}%` }}
				/>
			</div>
			{showTimes && (
				<span className="min-w-9 text-xs text-neutral-400 tabular-nums">
					{formatPlaybackTime(duration)}
				</span>
			)}
		</div>
	);
}
