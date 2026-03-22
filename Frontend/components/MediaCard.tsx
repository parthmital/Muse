"use client";

import Link from "next/link";
import { IconButton } from "./ui/IconButton";
import { FallbackImage } from "./ui/FallbackImage";
import { useColorExtraction } from "@/hooks/useColorExtraction";

export type MediaType = "mix" | "artist" | "album" | "playlist";

export interface MediaItem {
	type?: MediaType;
	title: string;
	songs?: number;
	desc?: string;
	artist?: string;
	pinned?: boolean;
	// Tidal integration fields (optional, backward-compatible)
	tidalId?: number;
	imageUrl?: string;
}

interface MediaCardProps {
	item: MediaItem;
}

export function MediaCard({ item }: MediaCardProps) {
	const inferredType = item.type || "mix";
	const routeId = item.tidalId
		? String(item.tidalId)
		: encodeURIComponent(item.title);
	const href =
		inferredType === "artist"
			? `/artist/${routeId}`
			: inferredType === "album"
				? `/album/${routeId}`
				: `/playlist/${routeId}`;

	const fallbackMap: Record<MediaType, "Playlist" | "Album" | "Artist"> = {
		playlist: "Playlist",
		mix: "Playlist",
		album: "Album",
		artist: "Artist",
	};

	const src = item.imageUrl || "";

	const extractedColor = useColorExtraction({
		src,
		mode: "brighten",
	});

	const isArtist = inferredType === "artist";

	return (
		<Link href={href} className="contents">
			<div className="group relative">
				<div
					className={`flex w-44 shrink-0 flex-col gap-2 ${isArtist ? "items-center" : ""}`}
				>
					<div className="relative mb-1 aspect-square w-full">
						<FallbackImage
							className={
								isArtist
									? "rounded-full object-cover"
									: "rounded-lg object-cover"
							}
							src={src}
							alt={item.title}
							fill
							fallbackType={fallbackMap[inferredType]}
						/>
					</div>
					{isArtist ? (
						<p className="line-clamp-1 font-medium text-white">{item.title}</p>
					) : (
						<>
							<div className="flex items-center justify-between">
								<p className="line-clamp-1 font-medium text-white">
									{item.title}
								</p>
								{(item.songs !== undefined || inferredType !== "album") && (
									<p
										className={
											!extractedColor ? "text-white" : "text-(--text-color)"
										}
										style={
											{ "--text-color": extractedColor } as React.CSSProperties
										}
									>
										{item.songs || 0}
									</p>
								)}
							</div>
							{(item.artist || item.desc) && (
								<p className="line-clamp-2 text-xs">
									{item.artist || item.desc}
								</p>
							)}
						</>
					)}
				</div>
				{item.pinned && (
					<IconButton
						icon="Pin"
						alt="Pinned"
						filled
						className="absolute top-1 right-1 z-10 rounded-full bg-black"
					/>
				)}
			</div>
		</Link>
	);
}
