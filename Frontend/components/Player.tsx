"use client";

import { useState } from "react";
import Image from "next/image";
import { IconButton } from "./ui/IconButton";
import { TrackInfo } from "./TrackInfo";
import { ProgressBar } from "./ui/ProgressBar";
import { VolumeSlider } from "./ui/VolumeSlider";
import { QueuePanel } from "./QueuePanel";
import { NowPlaying } from "./NowPlaying";
import { usePlayer } from "@/context/PlayerContext";
import { useSongActions } from "@/hooks/useContextMenu";
import { useToast } from "@/context/ToastContext";
import { DynamicActionMenu } from "./DynamicActionMenu";
import { trackKey } from "@/lib/trackKey";

export function Player() {
	const {
		currentTrack,
		isPlaying,
		progress,
		duration,
		volume,
		togglePlay,
		seek,
		setVolume,
		skipToNext,
		skipToPrev,
		toggleShuffle,
		toggleRepeat,
		isShuffled,
		repeatMode,
	} = usePlayer();
	const { toggleLike, isLiked } = useSongActions();
	const { toast } = useToast();

	const [showQueue, setShowQueue] = useState(false);
	const [showNowPlaying, setShowNowPlaying] = useState(false);
	const [lastVolume, setLastVolume] = useState(0.7);

	const songKey = currentTrack ? trackKey(currentTrack) : "";
	const liked = currentTrack ? isLiked(songKey, currentTrack.liked) : false;

	const handleLike = () => {
		if (!currentTrack) return;
		toggleLike(songKey);
		toast({
			message: liked ? "Removed from Liked Songs" : "Added to Liked Songs",
			variant: "success",
		});
	};

	const toggleMute = () => {
		if (volume > 0) {
			setLastVolume(volume);
			setVolume(0);
		} else {
			setVolume(lastVolume || 0.7);
		}
	};

	return (
		<>
			{/* ── Desktop player bar ─────────────────────────────────────────── */}
			<div className="hidden shrink-0 items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 md:flex">
				<div className="flex grow items-center gap-2">
					<IconButton
						icon={isPlaying ? "Pause" : "Play"}
						alt={isPlaying ? "Pause" : "Play"}
						ariaLabel={isPlaying ? "Pause" : "Play"}
						ariaPressed={isPlaying}
						onClick={togglePlay}
					/>
					<IconButton
						icon="Prev"
						alt="Previous"
						ariaLabel="Previous track"
						onClick={skipToPrev}
					/>
					<IconButton
						icon="Next"
						alt="Next"
						ariaLabel="Next track"
						onClick={skipToNext}
					/>
					<IconButton
						icon="Shuffle"
						alt="Shuffle"
						ariaLabel="Shuffle"
						ariaPressed={isShuffled}
						onClick={toggleShuffle}
						filled={isShuffled}
					/>
					<IconButton
						icon="Loop"
						alt={`Repeat: ${repeatMode}`}
						ariaLabel={`Repeat: ${repeatMode}`}
						ariaPressed={repeatMode !== "off"}
						onClick={toggleRepeat}
						filled={repeatMode !== "off"}
					/>
					<ProgressBar
						progress={progress}
						duration={duration}
						onSeek={seek}
						className="flex-1"
					/>

					<div className="group relative flex items-center">
						<IconButton
							icon="Volume"
							alt="Volume"
							ariaLabel={volume === 0 ? "Unmute" : "Mute"}
							onClick={toggleMute}
						/>
						{/* Vertical slider popover. `pb-2` bridges the gap to the icon so
						    the hover target stays continuous. */}
						<div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 pb-2 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
							<div className="flex justify-center rounded-lg border border-neutral-800 bg-neutral-900 p-3 shadow-xl">
								<VolumeSlider
									value={volume}
									onChange={setVolume}
									className="h-24"
								/>
							</div>
						</div>
					</div>

					<button
						onClick={() => currentTrack && setShowNowPlaying(true)}
						className="flex flex-1 items-center gap-3 overflow-hidden text-left"
						aria-label="Open now playing"
					>
						<TrackInfo
							className="w-full min-w-0"
							image={currentTrack?.img || ""}
							title={currentTrack?.title || "No track selected"}
							artist={currentTrack?.artist || "Select a song to play"}
						/>
					</button>
				</div>

				<div className="flex items-center gap-2">
					<IconButton
						icon="Like"
						alt="Like"
						ariaLabel={liked ? "Unlike" : "Like"}
						ariaPressed={liked}
						filled={liked}
						onClick={handleLike}
					/>
					<IconButton
						icon="Queue"
						alt="Queue"
						ariaLabel="Queue"
						ariaPressed={showQueue}
						filled={showQueue}
						onClick={() => setShowQueue((v) => !v)}
					/>
					<DynamicActionMenu
						type="track"
						id={String(currentTrack?.tidalId || "")}
						align="right"
						placement="top"
						trigger={
							<IconButton icon="More" alt="More" ariaLabel="More options" />
						}
						song={currentTrack}
					/>
				</div>
			</div>

			{/* ── Mobile mini player ─────────────────────────────────────────── */}
			{currentTrack && (
				<div
					className="fixed inset-x-2 z-40 overflow-hidden rounded-2xl bg-slate-700/80 px-3 pt-2 pb-3 backdrop-blur-md md:hidden"
					style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
				>
					<div className="flex items-center gap-3">
						<button
							onClick={() => setShowNowPlaying(true)}
							className="flex min-w-0 flex-1 items-center gap-3 text-left"
							aria-label="Open now playing"
						>
							<div className="relative h-10 w-10 shrink-0 overflow-hidden rounded">
								{currentTrack.img ? (
									<Image
										src={currentTrack.img}
										alt={currentTrack.title}
										fill
										sizes="40px"
										className="object-cover"
									/>
								) : (
									<div className="h-full w-full bg-neutral-800" />
								)}
							</div>
							<div className="min-w-0">
								<p className="truncate text-base text-white">
									{currentTrack.title}
								</p>
								<p className="truncate text-sm text-neutral-300">
									{currentTrack.artist}
								</p>
							</div>
						</button>
						<IconButton
							icon="Add to Library"
							alt="Save to library"
							ariaLabel={liked ? "Remove from library" : "Save to library"}
							ariaPressed={liked}
							filled={liked}
							onClick={handleLike}
						/>
						<IconButton
							icon={isPlaying ? "Pause Simple" : "Play Simple"}
							alt={isPlaying ? "Pause" : "Play"}
							ariaLabel={isPlaying ? "Pause" : "Play"}
							ariaPressed={isPlaying}
							onClick={togglePlay}
						/>
					</div>

					{/* Integrated progress hairline along the bottom edge */}
					<div
						className="absolute inset-x-3 bottom-1 h-0.5 overflow-hidden rounded-full bg-white/25"
						aria-hidden
					>
						<div
							className="h-full rounded-full bg-white"
							style={{
								width: duration ? `${(progress / duration) * 100}%` : "0%",
							}}
						/>
					</div>
				</div>
			)}

			{/* ── Desktop queue drawer ───────────────────────────────────────── */}
			{showQueue && (
				<>
					<div
						className="fixed inset-0 z-[60] hidden md:block"
						onClick={() => setShowQueue(false)}
					/>
					<div className="fixed top-4 right-4 bottom-24 z-[61] hidden w-80 flex-col rounded-lg border border-neutral-800 bg-neutral-950 p-4 shadow-2xl md:flex">
						<QueuePanel onClose={() => setShowQueue(false)} />
					</div>
				</>
			)}

			<NowPlaying
				open={showNowPlaying}
				onClose={() => setShowNowPlaying(false)}
			/>
		</>
	);
}
