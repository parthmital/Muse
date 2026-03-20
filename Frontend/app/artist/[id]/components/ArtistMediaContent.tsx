"use client";

import { MediaCard } from "@/components/MediaCard";
import { AlbumListItem } from "./AlbumListItem";

export interface Album {
	title: string;
	year: string;
	img: string;
	songsCount: number;
}

interface ArtistMediaContentProps {
	items: Album[];
	viewMode: "Grid" | "List";
}

export function ArtistMediaContent({
	items,
	viewMode,
}: ArtistMediaContentProps) {
	return (
		<section className="flex flex-col gap-6">
			{viewMode === "Grid" ? (
				<div className="flex flex-wrap gap-6">
					{items.map((item) => (
						<MediaCard
							key={item.title}
							item={{
								type: "album",
								title: item.title,
								artist: item.year,
								songs: item.songsCount,
							}}
						/>
					))}
				</div>
			) : (
				<div className="flex flex-col gap-8">
					{items.map((item) => (
						<AlbumListItem key={item.title} {...item} />
					))}
				</div>
			)}
		</section>
	);
}
