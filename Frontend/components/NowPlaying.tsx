"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePlayer } from "@/context/PlayerContext";
import { useSongActions } from "@/hooks/useContextMenu";
import { useToast } from "@/context/ToastContext";
import { IconButton } from "./ui/IconButton";
import { ProgressBar } from "./ui/ProgressBar";
import { QueuePanel } from "./QueuePanel";
import { Lyrics } from "./Lyrics";
import { DynamicActionMenu } from "./DynamicActionMenu";
import { formatPlaybackTime } from "@/utils/duration";
import { trackKey } from "@/lib/trackKey";
import { useMediaActions } from "@/hooks/useMediaActions";

function bumpImageSize(url: string, size = 640): string {
	if (!url || !url.includes("/tidal/images/")) return url;
	try {
		const u = new URL(url);
		u.searchParams.set("size", String(size));
		return u.toString();
	} catch {
		return url;
	}
}

export function NowPlaying({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
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
	const { toggleLike, isLiked, toggleLibrary, isInLibrary } = useSongActions();
	const { share } = useMediaActions();
	const { toast } = useToast();
	const [tab, setTab] = useState<"queue" | "lyrics">("queue");

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	if (!open || !currentTrack) return null;

	const songKey = trackKey(currentTrack);
	const liked = isLiked(songKey, currentTrack.liked);
	const art = bumpImageSize(currentTrack.img, 640);

	const handleLike = () => {
		toggleLike(songKey);
		toast({
			message: liked ? "Removed from Liked Songs" : "Added to Liked Songs",
			variant: "success",
		});
	};

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Now playing"
			className="fixed inset-0 z-[9000] flex flex-col bg-gradient-to-b from-slate-800 to-slate-950 duration-200 animate-in fade-in md:from-neutral-900 md:to-black"
		>
			{/* ── Mobile layout ──────────────────────────────────────────────── */}
			<div className="flex min-h-0 flex-1 flex-col md:hidden">
				<div className="flex items-center justify-between px-3 py-2">
					<IconButton
						icon="Down"
						alt="Collapse"
						ariaLabel="Collapse now playing"
						onClick={onClose}
					/>
					<p className="min-w-0 truncate px-2 text-center text-sm font-bold text-white">
						{currentTrack.album || currentTrack.artist}
					</p>
					<DynamicActionMenu
						type="track"
						id={String(currentTrack.tidalId || "")}
						align="right"
						placement="bottom"
						song={currentTrack}
						trigger={
							<IconButton icon="More" alt="More" ariaLabel="More options" />
						}
					/>
				</div>

				<div className="flex flex-col gap-5 px-4 pt-2">
					<div className="relative aspect-square w-full overflow-hidden rounded-lg shadow-2xl">
						{art ? (
							<Image
								src={art}
								alt={currentTrack.title}
								fill
								sizes="100vw"
								className="object-cover"
								priority
							/>
						) : (
							<div className="h-full w-full bg-neutral-800" />
						)}
					</div>

					<div className="flex items-center justify-between gap-3">
						<div className="min-w-0">
							<h1 className="truncate text-2xl font-bold text-white">
								{currentTrack.title}
							</h1>
							{currentTrack.tidalArtistId ? (
								<Link
									href={`/artist/${currentTrack.tidalArtistId}`}
									onClick={onClose}
									className="truncate text-base text-neutral-400"
								>
									{currentTrack.artist}
								</Link>
							) : (
								<p className="truncate text-base text-neutral-400">
									{currentTrack.artist}
								</p>
							)}
						</div>
						<div className="flex shrink-0 items-center">
							<IconButton
								icon="Like"
								alt="Like"
								ariaLabel={liked ? "Unlike" : "Like"}
								ariaPressed={liked}
								filled={liked}
								onClick={handleLike}
							/>
							<IconButton
								icon={isInLibrary(songKey) ? "Check" : "Add to Library"}
								alt="Save to library"
								ariaLabel={
									isInLibrary(songKey)
										? "Remove from library"
										: "Save to library"
								}
								ariaPressed={isInLibrary(songKey)}
								filled={isInLibrary(songKey)}
								onClick={() => toggleLibrary(songKey)}
							/>
						</div>
					</div>

					<div>
						<ProgressBar
							progress={progress}
							duration={duration}
							onSeek={seek}
							showTimes={false}
						/>
						<div className="mt-2 flex justify-between text-xs text-neutral-400 tabular-nums">
							<span>{formatPlaybackTime(progress)}</span>
							<span>
								-{formatPlaybackTime(Math.max(0, duration - progress))}
							</span>
						</div>
					</div>

					<div className="flex items-center justify-between">
						<IconButton
							icon="Shuffle"
							alt="Shuffle"
							ariaLabel="Shuffle"
							ariaPressed={isShuffled}
							filled={isShuffled}
							onClick={toggleShuffle}
						/>
						<IconButton
							icon="Prev"
							alt="Previous"
							ariaLabel="Previous track"
							onClick={skipToPrev}
						/>
						<button
							onClick={togglePlay}
							aria-label={isPlaying ? "Pause" : "Play"}
							aria-pressed={isPlaying}
							className="flex h-16 w-16 items-center justify-center rounded-full bg-white"
						>
							<Image
								src={`/icons/Name=${isPlaying ? "Pause" : "Play"}, Filled=No.svg`}
								alt=""
								width={40}
								height={40}
								className="brightness-0"
							/>
						</button>
						<IconButton
							icon="Next"
							alt="Next"
							ariaLabel="Next track"
							onClick={skipToNext}
						/>
						<IconButton
							icon="Loop"
							alt={`Repeat: ${repeatMode}`}
							ariaLabel={`Repeat: ${repeatMode}`}
							ariaPressed={repeatMode !== "off"}
							filled={repeatMode !== "off"}
							onClick={toggleRepeat}
						/>
					</div>

					<div className="flex items-center justify-between">
						<IconButton
							icon="Share"
							alt="Share"
							ariaLabel="Share"
							onClick={() =>
								share(`${currentTrack.title} — ${currentTrack.artist}`)
							}
						/>
						<IconButton
							icon="Lyrics"
							alt="Lyrics"
							ariaLabel="Show lyrics"
							ariaPressed={tab === "lyrics"}
							onClick={() => setTab("lyrics")}
							className={tab === "lyrics" ? "rounded-lg bg-white/10" : ""}
						/>
						<IconButton
							icon="Queue"
							alt="Queue"
							ariaLabel="Show queue"
							ariaPressed={tab === "queue"}
							onClick={() => setTab("queue")}
							className={tab === "queue" ? "rounded-lg bg-white/10" : ""}
						/>
						<DynamicActionMenu
							type="track"
							id={String(currentTrack.tidalId || "")}
							align="right"
							placement="top"
							song={currentTrack}
							trigger={
								<IconButton icon="More" alt="More" ariaLabel="More options" />
							}
						/>
					</div>
				</div>

				<div className="mt-4 min-h-0 flex-1 overflow-hidden px-4 pb-4">
					{tab === "queue" ? <QueuePanel /> : <Lyrics />}
				</div>
			</div>

			{/* ── Desktop layout ─────────────────────────────────────────────── */}
			<div className="hidden items-center justify-between p-4 md:flex">
				<IconButton
					icon="Down"
					alt="Collapse"
					ariaLabel="Collapse now playing"
					onClick={onClose}
				/>
				<p className="text-sm font-bold tracking-wide text-neutral-300 uppercase">
					Now Playing
				</p>
				<div className="w-10" />
			</div>

			<div className="hidden min-h-0 flex-1 flex-col gap-8 overflow-hidden p-4 md:flex md:flex-row md:p-10">
				{/* Art + controls */}
				<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6">
					<div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-xl shadow-2xl">
						{art ? (
							<Image
								src={art}
								alt={currentTrack.title}
								fill
								sizes="(max-width: 768px) 80vw, 384px"
								className="object-cover"
								priority
							/>
						) : (
							<div className="h-full w-full bg-neutral-800" />
						)}
					</div>

					<div className="w-full max-w-sm">
						<div className="flex items-center justify-between gap-4">
							<div className="min-w-0">
								<h1 className="truncate text-2xl font-bold text-white">
									{currentTrack.title}
								</h1>
								{currentTrack.tidalArtistId ? (
									<Link
										href={`/artist/${currentTrack.tidalArtistId}`}
										onClick={onClose}
										className="truncate text-neutral-400 hover:text-white hover:underline"
									>
										{currentTrack.artist}
									</Link>
								) : (
									<p className="truncate text-neutral-400">
										{currentTrack.artist}
									</p>
								)}
							</div>
							<IconButton
								icon="Like"
								alt="Like"
								ariaLabel={liked ? "Unlike" : "Like"}
								ariaPressed={liked}
								filled={liked}
								onClick={handleLike}
							/>
						</div>

						<ProgressBar
							progress={progress}
							duration={duration}
							onSeek={seek}
							className="mt-4"
						/>

						<div className="mt-4 flex items-center justify-center gap-6">
							<IconButton
								icon="Shuffle"
								alt="Shuffle"
								ariaLabel="Shuffle"
								ariaPressed={isShuffled}
								filled={isShuffled}
								onClick={toggleShuffle}
							/>
							<IconButton
								icon="Prev"
								alt="Previous"
								ariaLabel="Previous track"
								onClick={skipToPrev}
							/>
							<IconButton
								icon={isPlaying ? "Pause" : "Play"}
								alt={isPlaying ? "Pause" : "Play"}
								ariaLabel={isPlaying ? "Pause" : "Play"}
								ariaPressed={isPlaying}
								onClick={togglePlay}
							/>
							<IconButton
								icon="Next"
								alt="Next"
								ariaLabel="Next track"
								onClick={skipToNext}
							/>
							<IconButton
								icon="Loop"
								alt={`Repeat: ${repeatMode}`}
								ariaLabel={`Repeat: ${repeatMode}`}
								ariaPressed={repeatMode !== "off"}
								filled={repeatMode !== "off"}
								onClick={toggleRepeat}
							/>
						</div>
					</div>
				</div>

				{/* Queue / Lyrics */}
				<div className="flex min-h-0 flex-1 flex-col rounded-xl bg-black/30 p-4 md:max-w-md">
					<div className="mb-3 flex gap-2">
						{(["queue", "lyrics"] as const).map((t) => (
							<button
								key={t}
								onClick={() => setTab(t)}
								className={`rounded-full px-4 py-1.5 text-sm font-bold capitalize transition-colors ${
									tab === t
										? "bg-white text-black"
										: "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
								}`}
							>
								{t === "queue" ? "Up Next" : "Lyrics"}
							</button>
						))}
					</div>
					<div className="min-h-0 flex-1">
						{tab === "queue" ? <QueuePanel /> : <Lyrics />}
					</div>
				</div>
			</div>
		</div>
	);
}
