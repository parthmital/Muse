"use client";

import Link from "next/link";
import { IconButton } from "./ui/IconButton";
import { FallbackImage } from "./ui/FallbackImage";
import { useColorExtraction } from "@/hooks/useColorExtraction";
import { DynamicActionMenu } from "./DynamicActionMenu";

export type MediaType = "mix" | "artist" | "album" | "playlist" | "track";

export interface MediaItem {
	type?: MediaType;
	title: string;
	songs?: number;
	desc?: string;
	artist?: string;
	pinned?: boolean;
	// Tidal integration fields (optional, backward-compatible)
	tidalId?: number | string;
	imageUrl?: string;
}

interface MediaCardProps {
	item: MediaItem;
	disableHoverTransitions?: boolean;
}

export function MediaCard({
	item,
	disableHoverTransitions = false,
}: MediaCardProps) {
	const inferredType = item.type || "mix";
	const routeId =
		item.tidalId !== undefined
			? String(item.tidalId)
			: encodeURIComponent(item.title);

	// Track results in cards often point to their album or a player action.
	// We'll point them to a fallback or handle in item data.
	const href =
		inferredType === "artist"
			? `/artist/${routeId}`
			: inferredType === "album" || inferredType === "track"
				? `/album/${routeId}`
				: `/playlist/${routeId}`;

	const fallbackMap: Record<
		MediaType,
		"Playlist" | "Album" | "Artist" | "Notes"
	> = {
		playlist: "Playlist",
		mix: "Playlist",
		album: "Album",
		artist: "Artist",
		track: "Notes",
	};

	const src = item.imageUrl || "";

	const extractedColor = useColorExtraction({
		src,
		mode: "brighten",
	});

	const isArtist = inferredType === "artist";

	return (
		<DynamicActionMenu
			type={inferredType}
			id={routeId}
			openOnClick={false}
			trigger={
				<div className="group relative w-44 shrink-0">
					{/* Main card content - wrapped in Link for navigation */}
					<Link href={href} className="block">
						<div
							className={`flex flex-col gap-2 ${isArtist ? "items-center" : ""}`}
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
								<p className="line-clamp-1 font-medium text-white">
									{item.title}
								</p>
							) : (
								<>
									<div className="flex items-center justify-between gap-2">
										<p className="line-clamp-1 font-medium text-white">
											{item.title}
										</p>
										{(item.songs !== undefined || inferredType !== "album") && (
											<p style={{ color: extractedColor || "white" }}>
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
					</Link>

					{/* Action buttons - outside Link to prevent navigation */}
					<div className="absolute top-2 right-2 flex flex-col gap-2 z-20">
						{item.pinned && (
							<IconButton
								icon="Pin"
								alt="Pinned"
								filled
								className="rounded-full bg-black/60 backdrop-blur-md"
							/>
						)}
						<div
							className={
								disableHoverTransitions
									? "opacity-100"
									: "opacity-0 group-hover:opacity-100 transition-opacity"
							}
						>
							<DynamicActionMenu
								type={inferredType}
								id={routeId}
								openOnClick={true}
								trigger={
									<IconButton
										icon="More"
										alt="More"
										className="rounded-full bg-black/60 backdrop-blur-md"
										onClick={(e) => e.preventDefault()}
									/>
								}
							/>
						</div>
					</div>
				</div>
			}
		/>
	);
}
