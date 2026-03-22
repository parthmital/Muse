"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { IconButton } from "./ui/IconButton";
import { TrackInfo } from "./TrackInfo";
import { ActionMenu, ActionMenuItem } from "./ui/ActionMenu";
import { usePlayer } from "@/context/PlayerContext";
import { usePlaylistManager } from "@/hooks/usePlaylistManager";
import { formatPlaybackTime } from "@/utils/duration";

export function Player() {
	const {
		currentTrack,
		isPlaying,
		progress,
		duration,
		togglePlay,
		seek,
		audioQuality,
	} = usePlayer();

	const { isSongInPlaylist, toggleSongInPlaylist } = usePlaylistManager();

	const songKey = currentTrack
		? `${currentTrack.title}-${currentTrack.artist}`
		: "";

	const togglePlaylist = (playlistName: string) => {
		if (!songKey) return;
		toggleSongInPlaylist(playlistName, songKey);
		const isPresent = isSongInPlaylist(playlistName, songKey);
		console.log(
			`${!isPresent ? "Added" : "Removed"} ${currentTrack?.title} ${
				!isPresent ? "to" : "from"
			} ${playlistName}`,
		);
	};

	const playlistOptions: ActionMenuItem[] = [
		{
			label: "Create New Playlist",
			icon: "Add",
			onClick: () => console.log("Create New Playlist"),
		},
		{
			label: "Summer Hits",
			icon: "Playlist",
			checked: songKey ? isSongInPlaylist("Summer Hits", songKey) : false,
			onClick: () => togglePlaylist("Summer Hits"),
		},
		{
			label: "Workout Mix",
			icon: "Playlist",
			checked: songKey ? isSongInPlaylist("Workout Mix", songKey) : false,
			onClick: () => togglePlaylist("Workout Mix"),
		},
		{
			label: "Chill Vibes",
			icon: "Playlist",
			checked: songKey ? isSongInPlaylist("Chill Vibes", songKey) : false,
			onClick: () => togglePlaylist("Chill Vibes"),
		},
	];

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
			if (isDragging) {
				handleDrag(e.clientX);
			}
		};

		const handleMouseUp = (e: MouseEvent) => {
			if (isDragging) {
				if (progressBarRef.current && duration) {
					const rect = progressBarRef.current.getBoundingClientRect();
					const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
					const clickedPercent = x / rect.width;
					seek(clickedPercent * duration);
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
				<IconButton icon="Prev" alt="Previous" />
				<IconButton icon="Next" alt="Next" />
				<IconButton icon="Shuffle" alt="Shuffle" />
				<IconButton icon="Loop" alt="Loop" />

				<div className="flex grow items-center gap-4">
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
						{/* Thumb/Dot */}
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

				<div className="flex grow items-center gap-3">
					<TrackInfo
						className="min-w-0"
						image={currentTrack?.img || ""}
						title={currentTrack?.title || "No track selected"}
						artist={currentTrack?.artist || "Select a song to play"}
					/>
					{audioQuality && (
						<div className="flex shrink-0 items-center rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-bold text-neutral-400 tracking-wider">
							{audioQuality.replace(/_/g, " ")}
						</div>
					)}
				</div>
			</div>

			<div className="flex items-center gap-2">
				<IconButton icon="Like" alt="Like" />
				<ActionMenu
					showSearch={true}
					showCheckmarks={true}
					align="right"
					placement="top"
					trigger={<IconButton icon="Add to Playlist" alt="Add to Playlist" />}
					items={playlistOptions}
				/>
				<IconButton icon="Queue" alt="Queue" />
				<ActionMenu
					align="right"
					placement="top"
					trigger={<IconButton icon="More" alt="More" />}
					items={[
						{
							label: "Go to Artist",
							icon: "User",
							onClick: () => console.log("Go to Artist"),
						},
						{
							label: "Go to Album",
							icon: "Album",
							onClick: () => console.log("Go to Album"),
						},
						{
							label: "Share",
							icon: "Share",
							onClick: () => console.log("Share"),
						},
					]}
				/>
			</div>
		</div>
	);
}
