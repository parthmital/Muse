"use client";

import { useRef, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MediaShelf } from "@/components/MediaShelf";
import { MediaCard, MediaItem } from "@/components/MediaCard";
import { CategoryCard } from "@/components/CategoryCard";
import { ScrollContainer } from "@/components/ui/ScrollContainer";
import { SectionHeader } from "@/components/SectionHeader";
import { SongRow } from "@/components/SongRow";
import { FilterBar } from "@/components/FilterBar";
import { MediaGrid } from "@/components/MediaGrid";
import { ALL_SONGS } from "@/data/songs";
import { ALL_LIBRARY_ITEMS } from "@/data/library";
import { SearchSkeleton } from "@/components/ui/Skeletons";

const SEARCH_SECTIONS = [
	{
		title: "Discover",
		items: [
			"Made For You",
			"New Releases",
			"Charts",
			"Trending",
			"Discover",
			"Singles",
			"Decades",
		],
	},
	{
		title: "Genres",
		items: [
			"Pop",
			"Country",
			"Hip-Hop",
			"Rock",
			"Indie",
			"Punk",
			"Metal",
			"Instrumental",
		],
	},
	{
		title: "Mood & Activity",
		items: [
			"In The Car",
			"Mood",
			"Workout",
			"Chill",
			"Sleep",
			"Party",
			"At Home",
			"Focus",
		],
	},
	{
		title: "Entertainment",
		items: ["Netflix", "Anime", "Disney", "Gaming"],
	},
];

const RECENT_SEARCHES: MediaItem[] = [
	{ title: "Daft Punk", type: "artist" },
	{ title: "David Bowie", type: "artist" },
	{
		title: "Black Holes and Revelations",
		artist: "Muse",
		songs: 11,
		type: "album",
	},
	{
		title: "Discover Weekly",
		songs: 50,
		desc: "Your weekly mixtape of fresh music.",
		type: "mix",
	},
];

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
				{items.map((item) => (
					<CategoryCard key={item} title={item} />
				))}
			</ScrollContainer>
		</div>
	);
}

const FILTERS = ["All", "Songs", "Playlists", "Artists", "Albums"];

function SearchContentInner() {
	const searchParams = useSearchParams();
	const query = searchParams.get("q") || "";
	const [activeFilter, setActiveFilter] = useState("All");

	const filteredSongs = query
		? ALL_SONGS.filter(
				(s) =>
					s.title.toLowerCase().includes(query.toLowerCase()) ||
					s.artist.toLowerCase().includes(query.toLowerCase()),
			)
		: ALL_SONGS;

	const filteredMedia = query
		? ALL_LIBRARY_ITEMS.filter(
				(m) =>
					m.title.toLowerCase().includes(query.toLowerCase()) ||
					(m.artist && m.artist.toLowerCase().includes(query.toLowerCase())),
			)
		: ALL_LIBRARY_ITEMS;

	const artists = filteredMedia.filter((m) => m.type === "artist");
	const albums = filteredMedia.filter((m) => m.type === "album");
	const playlists = filteredMedia.filter((m) => m.type === "mix");

	if (query) {
		const hasResults = filteredSongs.length > 0 || filteredMedia.length > 0;

		return (
			<div className="flex flex-col gap-6">
				<FilterBar
					filters={FILTERS}
					activeFilter={activeFilter}
					onFilterChange={setActiveFilter}
				/>

				{activeFilter === "All" && !hasResults ? (
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
						{activeFilter === "All" && filteredMedia.length > 0 && (
							<div className="flex flex-col gap-4">
								<SectionHeader
									title="Top Result"
									titleClassName="text-xl font-bold"
									controls={false}
								/>
								<div className="w-96">
									<MediaCard item={filteredMedia[0]} />
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
										filteredSongs.map((song, i) => (
											<SongRow key={i} song={song} index={i} />
										))
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
			<MediaShelf title="Recent Searches" items={RECENT_SEARCHES} />
			<p className="text-xl font-bold text-white">Browse All</p>
			{SEARCH_SECTIONS.map((section) => (
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
