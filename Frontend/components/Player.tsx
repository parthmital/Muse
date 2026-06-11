"use client";

import { useState } from "react";
import Image from "next/image";
import { IconButton } from "./ui/IconButton";
import { TrackInfo } from "./TrackInfo";
import { ProgressBar } from "./ui/ProgressBar";
import { QueuePanel } from "./QueuePanel";
import { NowPlaying } from "./NowPlaying";
import { usePlayer } from "@/context/PlayerContext";
import { useSongActions } from "@/hooks/useContextMenu";
import { useToast } from "@/context/ToastContext";
import { DynamicActionMenu } from "./DynamicActionMenu";

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

	const songKey = currentTrack
		? `${currentTrack.title}-${currentTrack.artist}`
		: "";
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

					<div className="flex items-center gap-2">
						<IconButton
							icon="Volume"
							alt="Volume"
							ariaLabel={volume === 0 ? "Unmute" : "Mute"}
							onClick={toggleMute}
						/>
						<div className="w-20">
							<ProgressBar
								progress={volume * 100}
								duration={100}
								onSeek={(v) => setVolume(v / 100)}
								showTimes={false}
							/>
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
					className="fixed inset-x-2 z-40 flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/95 px-3 py-2 backdrop-blur-md md:hidden"
					style={{ bottom: "calc(3.6rem + env(safe-area-inset-bottom))" }}
				>
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
							<p className="truncate text-sm font-medium text-white">
								{currentTrack.title}
							</p>
							<p className="truncate text-xs text-neutral-400">
								{currentTrack.artist}
							</p>
						</div>
					</button>
					<IconButton
						icon="Like"
						alt="Like"
						ariaLabel={liked ? "Unlike" : "Like"}
						ariaPressed={liked}
						filled={liked}
						onClick={handleLike}
					/>
					<IconButton
						icon={isPlaying ? "Pause" : "Play"}
						alt={isPlaying ? "Pause" : "Play"}
						ariaLabel={isPlaying ? "Pause" : "Play"}
						ariaPressed={isPlaying}
						onClick={togglePlay}
					/>
				</div>
			)}

			{/* Mobile progress hairline under the mini player */}
			{currentTrack && (
				<div
					className="fixed inset-x-2 z-40 h-0.5 overflow-hidden rounded-full bg-neutral-800 md:hidden"
					style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
					aria-hidden
				>
					<div
						className="h-full bg-white"
						style={{
							width: duration ? `${(progress / duration) * 100}%` : "0%",
						}}
					/>
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
