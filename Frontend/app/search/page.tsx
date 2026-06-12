"use client";

import { useRef, Suspense, useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { MediaShelf } from "@/components/MediaShelf";
import { MediaCard, MediaItem } from "@/components/MediaCard";
import { CategoryCard } from "@/components/CategoryCard";
import { ScrollContainer } from "@/components/ui/ScrollContainer";
import { SectionHeader } from "@/components/SectionHeader";
import { SongRow, Song } from "@/components/SongRow";
import { FilterBar } from "@/components/FilterBar";
import { MediaGrid } from "@/components/MediaGrid";
import { SearchInput } from "@/components/ui/SearchInput";
import { SearchSkeleton } from "@/components/ui/Skeletons";
import { useTidalSearch } from "@/hooks/useTidalSearch";
import {
	tidalTrackToSong,
	tidalAlbumToMediaItem,
	tidalArtistToMediaItem,
	tidalPlaylistToMediaItem,
} from "@/lib/tidalAdapter";

// No fallbacks, exclusively backend.

import { getSearchSections, getRecentSearches } from "@/lib/api";
import useSWR from "swr";

function CategoryRow({ title, items }: { title: string; items: string[] }) {
	const scrollRef = useRef<HTMLDivElement>(null);

	return (
		<div className="flex flex-col gap-4">
			<SectionHeader
				title={title}
				scrollRef={scrollRef}
				titleClassName="text-lg font-medium"
			/>
			<ScrollContainer ref={scrollRef}>
				{items.map((item, index) => (
					<CategoryCard
						key={`${item}-${index}`}
						title={item}
						disableHoverZoom
					/>
				))}
			</ScrollContainer>
		</div>
	);
}

const FILTERS = ["All", "Songs", "Playlists", "Artists", "Albums"];

function SearchContentInner() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const query = searchParams.get("q") || "";

	const [activeFilter, setActiveFilter] = useState(() => {
		const filterFromUrl = searchParams.get("filter");
		return filterFromUrl && FILTERS.includes(filterFromUrl)
			? filterFromUrl
			: "All";
	});
	const [visibleSongs, setVisibleSongs] = useState(40);

	// Sync filter state to URL
	useEffect(() => {
		const currentFilter = searchParams.get("filter");
		if (activeFilter !== "All" && currentFilter !== activeFilter) {
			const params = new URLSearchParams(searchParams.toString());
			params.set("filter", activeFilter);
			router.replace(`?${params.toString()}`, { scroll: false });
		} else if (activeFilter === "All" && currentFilter) {
			const params = new URLSearchParams(searchParams.toString());
			params.delete("filter");
			router.replace(`?${params.toString()}`, { scroll: false });
		}
	}, [activeFilter, searchParams, router]);

	const { data: sectionsData } = useSWR("search-sections", getSearchSections);
	const { data: recentData } = useSWR("recent-searches", getRecentSearches);

	const searchSections = sectionsData?.categories || [];
	const recentSearches = recentData?.items || [];

	// Live Tidal search
	const tidalResults = useTidalSearch(query);

	// Convert Tidal results to existing component interfaces
	const tidalSongs: Song[] = (tidalResults.tracks || []).map(tidalTrackToSong);
	const tidalArtists: MediaItem[] = (tidalResults.artists || []).map(
		tidalArtistToMediaItem,
	);
	const tidalAlbums: MediaItem[] = (tidalResults.albums || []).map(
		tidalAlbumToMediaItem,
	);

	// Determine which data source to use:
	const hasResults =
		tidalSongs.length > 0 || tidalArtists.length > 0 || tidalAlbums.length > 0;

	const filteredSongs = tidalSongs;
	const artists = tidalArtists;
	const albums = tidalAlbums;
	const tidalPlaylists: MediaItem[] = (tidalResults.playlists || []).map(
		tidalPlaylistToMediaItem,
	);
	const playlists = tidalPlaylists;
	const visibleSongItems = useMemo(
		() => filteredSongs.slice(0, visibleSongs),
		[filteredSongs, visibleSongs],
	);

	useEffect(() => {
		setVisibleSongs(40);
	}, [query, activeFilter]);

	// Build top result for "All" view
	const topResultItem: MediaItem | null =
		tidalArtists[0] ?? tidalAlbums[0] ?? null;

	// Mobile-only search header (the global TopBar is hidden below md).
	const mobileSearchHeader = (
		<div className="flex items-center gap-3 md:hidden">
			<SearchInput placeholder="What do you want to play?" />
		</div>
	);

	if (query) {
		return (
			<div className="flex flex-col gap-6">
				{mobileSearchHeader}
				<FilterBar
					filters={FILTERS}
					activeFilter={activeFilter}
					onFilterChange={setActiveFilter}
				/>

				{tidalResults.isLoading && (
					<div className="flex items-center gap-2 text-neutral-500">
						<div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-500 border-t-transparent" />
						Searching TIDAL...
					</div>
				)}

				{tidalResults.error && (
					<div className="text-sm text-red-400">
						Search error: {tidalResults.error}. Showing local results.
					</div>
				)}

				{activeFilter === "All" && !hasResults && !tidalResults.isLoading ? (
					<div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
						<p className="text-xl font-bold text-white">
							No results found for &quot;{query}&quot;
						</p>
						<p className="text-neutral-400">
							Please make sure your words are spelled correctly or use fewer or
							different keywords.
						</p>
					</div>
				) : (
					<>
						{activeFilter === "All" && topResultItem && (
							<div className="flex flex-col gap-4">
								<SectionHeader
									title="Top Result"
									titleClassName="text-xl font-bold"
									controls={false}
								/>
								<div className="w-96">
									<MediaCard item={topResultItem} />
								</div>
							</div>
						)}

						{(activeFilter === "Songs" ||
							(activeFilter === "All" && filteredSongs.length > 0)) && (
							<div className="flex flex-col gap-4">
								<SectionHeader
									title="Songs"
									titleClassName="text-xl font-bold"
									controls={false}
								/>
								<div className="flex flex-col gap-2">
									{filteredSongs.length > 0 ? (
										<>
											{visibleSongItems.map((song, i) => (
												<SongRow
													key={String(
														song.tidalId ?? `${song.title}-${song.artist}`,
													)}
													song={song}
													index={i}
												/>
											))}
											{filteredSongs.length > visibleSongItems.length && (
												<button
													type="button"
													onClick={() => setVisibleSongs((prev) => prev + 40)}
													className="mt-3 self-start rounded-lg border border-neutral-700 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-800"
												>
													Load more songs
												</button>
											)}
										</>
									) : (
										<div className="text-neutral-500">
											No songs found for &quot;{query}&quot;
										</div>
									)}
								</div>
							</div>
						)}

						{(activeFilter === "Artists" ||
							(activeFilter === "All" && artists.length > 0)) && (
							<div className="flex flex-col gap-4">
								{activeFilter === "All" ? (
									<MediaShelf
										title="Artists"
										items={artists}
										titleClassName="text-xl font-bold"
									/>
								) : (
									<>
										<SectionHeader
											title="Artists"
											titleClassName="text-xl font-bold"
											controls={false}
										/>
										{artists.length > 0 ? (
											<MediaGrid items={artists} />
										) : (
											<div className="text-neutral-500">
												No artists found for &quot;{query}&quot;
											</div>
										)}
									</>
								)}
							</div>
						)}

						{(activeFilter === "Albums" ||
							(activeFilter === "All" && albums.length > 0)) && (
							<div className="flex flex-col gap-4">
								{activeFilter === "All" ? (
									<MediaShelf
										title="Albums"
										items={albums}
										titleClassName="text-xl font-bold"
									/>
								) : (
									<>
										<SectionHeader
											title="Albums"
											titleClassName="text-xl font-bold"
											controls={false}
										/>
										{albums.length > 0 ? (
											<MediaGrid items={albums} />
										) : (
											<div className="text-neutral-500">
												No albums found for &quot;{query}&quot;
											</div>
										)}
									</>
								)}
							</div>
						)}

						{(activeFilter === "Playlists" ||
							(activeFilter === "All" && playlists.length > 0)) && (
							<div className="flex flex-col gap-4">
								{activeFilter === "All" ? (
									<MediaShelf
										title="Playlists"
										items={playlists}
										titleClassName="text-xl font-bold"
									/>
								) : (
									<>
										<SectionHeader
											title="Playlists"
											titleClassName="text-xl font-bold"
											controls={false}
										/>
										{playlists.length > 0 ? (
											<MediaGrid items={playlists} />
										) : (
											<div className="text-neutral-500">
												No playlists found for &quot;{query}&quot;
											</div>
										)}
									</>
								)}
							</div>
						)}
					</>
				)}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			{mobileSearchHeader}
			{recentSearches.length > 0 && (
				<MediaShelf title="Recent Searches" items={recentSearches} />
			)}
			<p className="text-xl font-bold text-white">Browse All</p>
			{searchSections.map((section: { title: string; items: string[] }) => (
				<CategoryRow
					key={section.title}
					title={section.title}
					items={section.items}
				/>
			))}
		</div>
	);
}

export default function SearchPage() {
	return (
		<Suspense fallback={<SearchSkeleton />}>
			<SearchContentInner />
		</Suspense>
	);
}
