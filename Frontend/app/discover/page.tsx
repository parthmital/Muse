"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FilterBar } from "@/components/FilterBar";
import { MediaGrid } from "@/components/MediaGrid";
import { MediaItem } from "@/components/MediaCard";
import { searchTracks, searchAlbums } from "@/lib/api";
import {
	tidalAlbumToMediaItem,
	tidalTrackToMediaItem,
} from "@/lib/tidalAdapter";

// ── Genre-to-search mapping ─────────────────────────────────────────────────

const GENRE_QUERIES: Record<string, string> = {
	Music: "top hits",
	EDM: "electronic dance music",
	Indie: "indie music",
	Pop: "pop hits",
	Rock: "rock music",
	"Alt Rock": "alternative rock",
	Country: "country music",
	"R&B": "r&b music",
	"Hip-Hop": "hip hop",
};

const GENRE_FILTERS = [
	"Music",
	"EDM",
	"Indie",
	"Pop",
	"Rock",
	"Alt Rock",
	"Country",
	"R&B",
	"Hip-Hop",
];

function DiscoverContent() {
	const searchParams = useSearchParams();
	const router = useRouter();

	const [activeFilter, setActiveFilter] = useState(() => {
		const filterFromUrl = searchParams.get("filter");
		return filterFromUrl && GENRE_FILTERS.includes(filterFromUrl)
			? filterFromUrl
			: "Music";
	});
	const [tidalItems, setTidalItems] = useState<MediaItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	// Sync filter state to URL
	useEffect(() => {
		const currentFilter = searchParams.get("filter");
		if (activeFilter !== "Music" && currentFilter !== activeFilter) {
			const params = new URLSearchParams(searchParams.toString());
			params.set("filter", activeFilter);
			router.replace(`?${params.toString()}`, { scroll: false });
		} else if (activeFilter === "Music" && currentFilter) {
			const params = new URLSearchParams(searchParams.toString());
			params.delete("filter");
			router.replace(`?${params.toString()}`, { scroll: false });
		}
	}, [activeFilter, searchParams, router]);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);

		const searchQuery = GENRE_QUERIES[activeFilter] ?? activeFilter;

		async function fetchDiscover() {
			try {
				const [trackRes, albumRes] = await Promise.allSettled([
					searchTracks(searchQuery, 8),
					searchAlbums(searchQuery, 8),
				]);

				if (cancelled) return;

				const items: MediaItem[] = [];

				// Add albums from search
				if (
					albumRes.status === "fulfilled" &&
					albumRes.value.items.length > 0
				) {
					items.push(...albumRes.value.items.map(tidalAlbumToMediaItem));
				}

				// Add unique albums from tracks
				if (
					trackRes.status === "fulfilled" &&
					trackRes.value.items.length > 0
				) {
					const existingIds = new Set(items.map((i) => i.tidalId));
					for (const track of trackRes.value.items) {
						const albumId = track.album?.id;
						if (albumId && !existingIds.has(albumId)) {
							existingIds.add(albumId);
							items.push(tidalTrackToMediaItem(track));
						}
					}
				}

				setTidalItems(items);
			} catch {
				// Silently fall back to static data
				setTidalItems([]);
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		}

		fetchDiscover();
		return () => {
			cancelled = true;
		};
	}, [activeFilter]);

	const displayItems = tidalItems;

	return (
		<>
			<FilterBar
				filters={GENRE_FILTERS}
				activeFilter={activeFilter}
				onFilterChange={setActiveFilter}
			/>
			{isLoading ? (
				<div className="flex items-center justify-center py-20">
					<div className="flex items-center gap-3 text-neutral-500">
						<div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-500 border-t-transparent" />
						<span>Loading from TIDAL...</span>
					</div>
				</div>
			) : displayItems.length > 0 ? (
				<MediaGrid items={displayItems} />
			) : (
				<div className="text-center py-20 text-neutral-500">
					No results from TIDAL. Try another category.
				</div>
			)}
		</>
	);
}

export default function DiscoverPage() {
	// useSearchParams() requires a Suspense boundary during prerender/CSR bailout.
	return (
		<Suspense fallback={null}>
			<DiscoverContent />
		</Suspense>
	);
}
