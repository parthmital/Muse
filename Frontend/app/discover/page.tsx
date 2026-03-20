import { FilterBar } from "@/components/FilterBar";
import { MediaGrid } from "@/components/MediaGrid";
import { MediaItem } from "@/components/MediaCard";
import { ALL_PLAYLISTS, ALL_ALBUMS } from "@/data/library";

// Derive discover items from centralized data
const DISCOVER_PLAYLISTS: MediaItem[] = ALL_PLAYLISTS.filter((p) =>
	[
		"Chill Stuff",
		"Vibe",
		"Selected Linkin Park",
		"Fav Bands",
		"Daily Mix 1",
		"Daily Mix 2",
		"Daily Mix 3",
		"Rock Mix",
		"Chill Mix",
		"Pop Mix",
	].includes(p.title),
);

const DISCOVER_ALBUMS: MediaItem[] = ALL_ALBUMS.filter((a) =>
	[
		"Meteora",
		"Random Access Memories",
		"Abbey Road",
		"Black Holes and Revelations",
	].includes(a.title),
);

const DISCOVER_ITEMS: MediaItem[] = [
	...DISCOVER_PLAYLISTS.slice(0, 4),
	...DISCOVER_ALBUMS,
	...DISCOVER_PLAYLISTS.slice(4),
];

export default function DiscoverPage() {
	return (
		<>
			<FilterBar
				filters={[
					"Music",
					"EDM",
					"Indie",
					"Pop",
					"Rock",
					"Alt Rock",
					"Country",
					"R&B",
					"Hip-Hop",
				]}
			/>
			<MediaGrid items={DISCOVER_ITEMS} />
		</>
	);
}
