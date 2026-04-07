"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { IconButton } from "./ui/IconButton";
import { TrackInfo } from "./TrackInfo";
import { usePlayer } from "@/context/PlayerContext";
import { DynamicActionMenu } from "./DynamicActionMenu";
import { formatPlaybackTime } from "@/utils/duration";

export function Player() {
	const {
		currentTrack,
		isPlaying,
		progress,
		duration,
		togglePlay,
		seek,
		skipToNext,
		skipToPrev,
		toggleShuffle,
		toggleRepeat,
		isShuffled,
		repeatMode,
	} = usePlayer();

	const [isDragging, setIsDragging] = useState(false);
	const [dragProgress, setDragProgress] = useState(0);
	const progressBarRef = useRef<HTMLDivElement>(null);

	const displayProgress = isDragging ? dragProgress : progress;
	const progressPercent = duration ? (displayProgress / duration) * 100 : 0;

	const handleMouseDown = (e: React.MouseEvent) => {
		setIsDragging(true);
		handleDrag(e.clientX);
	};

	const handleDrag = useCallback(
		(clientX: number) => {
			if (progressBarRef.current && duration) {
				const rect = progressBarRef.current.getBoundingClientRect();
				const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
				const clickedPercent = x / rect.width;
				setDragProgress(clickedPercent * duration);
			}
		},
		[duration],
	);

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (isDragging) handleDrag(e.clientX);
		};

		const handleMouseUp = (e: MouseEvent) => {
			if (isDragging) {
				if (progressBarRef.current && duration) {
					const rect = progressBarRef.current.getBoundingClientRect();
					const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
					seek((x / rect.width) * duration);
				}
				setIsDragging(false);
			}
		};

		if (isDragging) {
			window.addEventListener("mousemove", handleMouseMove);
			window.addEventListener("mouseup", handleMouseUp);
		}

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [isDragging, duration, seek, handleDrag]);

	return (
		<div className="flex shrink-0 items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2">
			<div className="flex grow items-center gap-2">
				<IconButton
					icon={isPlaying ? "Pause" : "Play"}
					alt={isPlaying ? "Pause" : "Play"}
					onClick={togglePlay}
				/>
				<IconButton icon="Prev" alt="Previous" onClick={skipToPrev} />
				<IconButton icon="Next" alt="Next" onClick={skipToNext} />
				<IconButton
					icon="Shuffle"
					alt="Shuffle"
					onClick={toggleShuffle}
					filled={isShuffled}
				/>
				<IconButton
					icon="Loop"
					alt={`Repeat: ${repeatMode}`}
					onClick={toggleRepeat}
					filled={repeatMode !== "off"}
				/>
				<div className="flex flex-1 items-center gap-4 min-w-0">
					<p className="min-w-8 text-right text-xs text-neutral-400">
						{formatPlaybackTime(displayProgress)}
					</p>
					<div
						ref={progressBarRef}
						className="group relative h-1 grow cursor-pointer rounded-lg bg-neutral-800"
						onMouseDown={handleMouseDown}
					>
						<div
							className="absolute z-10 h-full rounded-lg bg-white"
							style={{ width: `${progressPercent}%` }}
						></div>
						<div
							className="absolute top-1/2 z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
							style={{ left: `${progressPercent}%` }}
						></div>
					</div>
					<p className="min-w-8 text-xs text-neutral-400">
						{formatPlaybackTime(duration)}
					</p>
				</div>

				<IconButton icon="Volume" alt="Volume" />
				<div className="flex flex-1 items-center gap-3 min-w-0 overflow-hidden">
					<TrackInfo
						className="min-w-0 w-full"
						image={currentTrack?.img || ""}
						title={currentTrack?.title || "No track selected"}
						artist={currentTrack?.artist || "Select a song to play"}
					/>
				</div>
			</div>

			<div className="flex items-center gap-2">
				<IconButton icon="Like" alt="Like" />
				<IconButton icon="Queue" alt="Queue" />
				<DynamicActionMenu
					type="track"
					id={String(currentTrack?.tidalId || "")}
					align="right"
					placement="top"
					trigger={<IconButton icon="More" alt="More" />}
					song={currentTrack}
				/>
			</div>
		</div>
	);
}
