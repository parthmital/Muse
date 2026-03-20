"use client";

import { MediaShelf } from "@/components/MediaShelf";
import { MediaItem } from "@/components/MediaCard";
import { ALL_PLAYLISTS, ALL_ALBUMS, ALL_ARTISTS } from "@/data/library";

// Derive home page sections from the centralized data source
const MADE_FOR_YOU: MediaItem[] = ALL_PLAYLISTS.filter((p) =>
	[
		"Discover Weekly",
		"Daily Mix 1",
		"Daily Mix 2",
		"Daily Mix 3",
		"Daily Mix 4",
		"Nirvana Radio",
		"Fall Out Boy Radio",
	].includes(p.title),
);

const TOP_MIXES: MediaItem[] = ALL_PLAYLISTS.filter((p) =>
	[
		"Rock Mix",
		"Chill Mix",
		"Pop Mix",
		"Daft Punk Mix",
		"Happy Mix",
		"David Bowie Mix",
		"Upbeat Mix",
		"60s Mix",
	].includes(p.title),
);

const FAVOURITE_ARTISTS: MediaItem[] = ALL_ARTISTS.filter((a) =>
	["Guns N' Roses", "Daft Punk", "David Bowie"].includes(a.title),
);

const ALBUMS_FOR_YOU: MediaItem[] = ALL_ALBUMS.filter((a) =>
	[
		"Meteora",
		"Random Access Memories",
		"Abbey Road",
		"Black Holes and Revelations",
	].includes(a.title),
);

export default function Home() {
	return (
		<>
			<MediaShelf title="Made For You" items={MADE_FOR_YOU} />
			<MediaShelf title="Your Top Mixes" items={TOP_MIXES} />
			<MediaShelf title="Your Favourite Artists" items={FAVOURITE_ARTISTS} />
			<MediaShelf title="Albums For You" items={ALBUMS_FOR_YOU} />
		</>
	);
}
