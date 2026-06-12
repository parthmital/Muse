"use client";

import { useState } from "react";
import Image from "next/image";
import { usePlayer } from "@/context/PlayerContext";
import { IconButton } from "./ui/IconButton";

export function QueuePanel({ onClose }: { onClose?: () => void }) {
	const {
		queue,
		currentIndex,
		currentTrack,
		isPlaying,
		playFromQueue,
		removeFromQueue,
		moveInQueue,
	} = usePlayer();
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [overIndex, setOverIndex] = useState<number | null>(null);

	const upcoming = queue
		.map((track, index) => ({ track, index }))
		.filter(({ index }) => index > currentIndex);

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between px-1 pb-3">
				<h2 className="text-lg font-bold text-white">Queue</h2>
				{onClose && (
					<IconButton
						icon="Close"
						alt="Close queue"
						ariaLabel="Close queue"
						onClick={onClose}
					/>
				)}
			</div>

			<div className="flex-1 overflow-y-auto">
				{currentTrack && (
					<>
						<p className="px-1 py-2 text-xs font-bold tracking-wide text-neutral-500 uppercase">
							Now playing
						</p>
						<QueueRow
							track={currentTrack}
							active
							playing={isPlaying}
							onPlay={() => playFromQueue(currentIndex)}
						/>
					</>
				)}

				<p className="px-1 pt-4 pb-2 text-xs font-bold tracking-wide text-neutral-500 uppercase">
					Next up
				</p>
				{upcoming.length === 0 ? (
					<p className="px-1 py-6 text-sm text-neutral-500">
						Nothing queued. Tracks you play will appear here.
					</p>
				) : (
					upcoming.map(({ track, index }) => (
						<div
							key={`${track.tidalId ?? track.title}-${index}`}
							draggable
							onDragStart={() => setDragIndex(index)}
							onDragOver={(e) => {
								e.preventDefault();
								setOverIndex(index);
							}}
							onDrop={() => {
								if (dragIndex !== null && dragIndex !== index) {
									moveInQueue(dragIndex, index);
								}
								setDragIndex(null);
								setOverIndex(null);
							}}
							onDragEnd={() => {
								setDragIndex(null);
								setOverIndex(null);
							}}
							className={
								overIndex === index ? "rounded-lg ring-1 ring-white/30" : ""
							}
						>
							<QueueRow
								track={track}
								onPlay={() => playFromQueue(index)}
								onRemove={() => removeFromQueue(index)}
								draggable
							/>
						</div>
					))
				)}
			</div>
		</div>
	);
}

function QueueRow({
	track,
	active = false,
	playing = false,
	onPlay,
	onRemove,
	draggable = false,
}: {
	track: { title: string; artist: string; img: string };
	active?: boolean;
	playing?: boolean;
	onPlay: () => void;
	onRemove?: () => void;
	draggable?: boolean;
}) {
	return (
		<div
			className={`group/q flex items-center gap-3 rounded-lg px-1 py-2 ${
				active ? "bg-neutral-800/60" : "hover:bg-neutral-900"
			}`}
		>
			{draggable && (
				<span
					className="cursor-grab text-neutral-600 active:cursor-grabbing"
					aria-hidden
				>
					⠿
				</span>
			)}
			<button
				onClick={onPlay}
				className="flex min-w-0 flex-1 items-center gap-3 text-left"
			>
				<div className="relative h-10 w-10 shrink-0 overflow-hidden rounded">
					{track.img ? (
						<Image
							src={track.img}
							alt={track.title}
							fill
							sizes="40px"
							className="object-cover"
						/>
					) : (
						<div className="h-full w-full bg-neutral-800" />
					)}
				</div>
				<div className="min-w-0">
					<p
						className={`truncate text-sm ${active ? "font-bold text-green-400" : "text-white"}`}
					>
						{track.title}
						{active && playing ? " ♪" : ""}
					</p>
					<p className="truncate text-xs text-neutral-400">{track.artist}</p>
				</div>
			</button>
			{onRemove && (
				<button
					onClick={onRemove}
					aria-label={`Remove ${track.title} from queue`}
					className="shrink-0 px-2 text-neutral-600 opacity-0 group-hover/q:opacity-100 hover:text-white"
				>
					✕
				</button>
			)}
		</div>
	);
}
