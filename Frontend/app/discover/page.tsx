"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FilterBar } from "@/components/FilterBar";
import { MediaGrid } from "@/components/MediaGrid";
import { MediaItem } from "@/components/MediaCard";
import { fetchGenres, genreAlbums, GenreTag } from "@/lib/api";
import { tidalAlbumToMediaItem } from "@/lib/tidalAdapter";
import { MediaGridSkeleton } from "@/components/ui/Skeletons";
import { EmptyState } from "@/components/ui/EmptyState";

// "All" is a synthetic leading tab → global chart popularity (no genre tag).
const ALL_FILTER = "All";

function DiscoverContent() {
	const searchParams = useSearchParams();
	const router = useRouter();

	const [genres, setGenres] = useState<GenreTag[]>([]);
	const [activeFilter, setActiveFilter] = useState(
		() => searchParams.get("filter") ?? ALL_FILTER,
	);
	const [tidalItems, setTidalItems] = useState<MediaItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	// Filter labels for the bar: "All" plus the live Last.fm genres.
	const filters = useMemo(
		() => [ALL_FILTER, ...genres.map((g) => g.label)],
		[genres],
	);
	// Label → raw Last.fm tag, for the albums query.
	const labelToTag = useMemo(
		() => new Map(genres.map((g) => [g.label, g.tag])),
		[genres],
	);

	// Load the genre list once.
	useEffect(() => {
		let cancelled = false;
		fetchGenres(12)
			.then((res) => {
				if (!cancelled) setGenres(res.genres);
			})
			.catch(() => {
				if (!cancelled) setGenres([]);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	// If the URL/active filter isn't a known genre, fall back to "All".
	useEffect(() => {
		if (
			genres.length > 0 &&
			activeFilter !== ALL_FILTER &&
			!labelToTag.has(activeFilter)
		) {
			setActiveFilter(ALL_FILTER);
		}
	}, [genres, activeFilter, labelToTag]);

	// Keep the active filter in the URL (skip the default "All").
	useEffect(() => {
		const current = searchParams.get("filter");
		if (activeFilter !== ALL_FILTER && current !== activeFilter) {
			const params = new URLSearchParams(searchParams.toString());
			params.set("filter", activeFilter);
			router.replace(`?${params.toString()}`, { scroll: false });
		} else if (activeFilter === ALL_FILTER && current) {
			const params = new URLSearchParams(searchParams.toString());
			params.delete("filter");
			router.replace(`?${params.toString()}`, { scroll: false });
		}
	}, [activeFilter, searchParams, router]);

	// Fetch albums for the active filter.
	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);

		const tag =
			activeFilter === ALL_FILTER ? null : labelToTag.get(activeFilter);
		// A non-"All" filter whose tag isn't loaded yet: wait for genres to arrive.
		if (activeFilter !== ALL_FILTER && tag === undefined) return;

		genreAlbums(tag ?? null, 16)
			.then((res) => {
				if (!cancelled) setTidalItems(res.items.map(tidalAlbumToMediaItem));
			})
			.catch(() => {
				if (!cancelled) setTidalItems([]);
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [activeFilter, labelToTag]);

	return (
		<>
			<FilterBar
				filters={filters}
				activeFilter={activeFilter}
				onFilterChange={setActiveFilter}
			/>
			{isLoading ? (
				<MediaGridSkeleton />
			) : tidalItems.length > 0 ? (
				<MediaGrid items={tidalItems} />
			) : (
				<EmptyState
					icon="Discover"
					title="Nothing here yet"
					description="We couldn't find anything for this category. Try another genre to keep exploring."
				/>
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
