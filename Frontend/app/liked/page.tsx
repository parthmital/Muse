"use client";

import { useState, useEffect } from "react";
import { FilterBar } from "@/components/FilterBar";
import { Song, SongRow } from "@/components/SongRow";
import { SongListHeader } from "@/components/SongListHeader";
import { useSongActions } from "@/hooks/useSongActions";
import { useSorting } from "@/hooks/useSorting";
import { durationToSeconds } from "@/utils/duration";

import useSWR from "swr";
const fetcher = (url: string) => fetch(url).then((r) => r.json());

const LIKED_SONGS_SORT_OPTIONS = [
	{ value: "recently-added", label: "Recently Added" },
	{ value: "title", label: "Title" },
	{ value: "artist", label: "Artist" },
	{ value: "album", label: "Album" },
	{ value: "duration", label: "Duration" },
];

const SONG_COMPARATORS: Record<string, (a: Song, b: Song) => number> = {
	title: (a, b) => a.title.localeCompare(b.title),
	artist: (a, b) => {
		const cmp = a.artist.localeCompare(b.artist);
		return cmp !== 0 ? cmp : a.title.localeCompare(b.title);
	},
	album: (a, b) => {
		const cmp = a.album.localeCompare(b.album);
		return cmp !== 0 ? cmp : a.title.localeCompare(b.title);
	},
	duration: (a, b) =>
		durationToSeconds(b.duration) - durationToSeconds(a.duration),
};

export default function LikedPage() {
	const [searchQuery, setSearchQuery] = useState("");
	const [songSnapshot, setSongSnapshot] = useState<Song[] | null>(null);

	const {
		likedSongs,
		isInitialized,
		toggleLike,
		toggleLibrary,
		isLiked,
		isInLibrary,
	} = useSongActions();

	// Fetch all library data from backend
	const { data: libraryData } = useSWR<{
		library: { itemType: string; itemId: string }[];
	}>("http://localhost:8000/library", fetcher);

	// In a real scenario we need to fetch tracks by ID.
	// Since we are decoupling from mock ALL_SONGS, we default to empty array or fetch actual tracks.
	useEffect(() => {
		if (isInitialized && libraryData && songSnapshot === null) {
			const likedIds = libraryData.library
				.filter((i) => i.itemType === "liked_track")
				.map((i) => i.itemId);
			// MOCK API bridge for now: we have no bulk endpoint to fetch all track details by IDs easily
			// without rewriting the backend. Default to an empty array for now.
			const initialLiked: Song[] = [];
			const timer = setTimeout(() => {
				setSongSnapshot(initialLiked);
			}, 0);
			return () => clearTimeout(timer);
		}
	}, [isInitialized, libraryData, songSnapshot]);

	// Apply filtering on the snapshot
	const filteredSongs = (songSnapshot ?? []).filter(
		(song) =>
			song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
			song.album.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	const {
		sortedItems: sortedSongs,
		sortBy,
		sortOrder,
		setSortBy,
		setSortOrder,
		handleSort,
	} = useSorting({
		items: filteredSongs,
		defaultSortKey: "recently-added",
		comparators: SONG_COMPARATORS,
	});

	return (
		<>
			<FilterBar
				isLibrary
				hideViewModeToggle
				sortBy={sortBy}
				onSortChange={setSortBy}
				sortOptions={LIKED_SONGS_SORT_OPTIONS}
				onSearchChange={setSearchQuery}
				sortOrder={sortOrder}
				onSortOrderChange={setSortOrder}
			/>

			{!isInitialized ? (
				<div className="flex flex-col gap-2 opacity-50">
					<div className="p-4 text-white">Loading your music...</div>
				</div>
			) : (
				<div className="flex flex-col gap-2">
					<SongListHeader
						sortBy={sortBy}
						sortOrder={sortOrder}
						onSort={handleSort}
					/>

					{sortedSongs.length > 0 ? (
						sortedSongs.map((song, index) => {
							const songKey = `${song.title}-${song.artist}`;
							return (
								<SongRow
									key={`${songKey}-${index}`}
									song={song}
									index={index}
									liked={isLiked(songKey, song.liked)}
									inLibrary={isInLibrary(songKey)}
									onToggleLike={() => toggleLike(songKey)}
									onToggleLibrary={() => toggleLibrary(songKey)}
								/>
							);
						})
					) : (
						<div className="flex w-full flex-col items-center justify-center py-20 text-center">
							<p className="text-lg text-neutral-500">No liked songs yet.</p>
							<p className="text-sm text-neutral-600">
								Click the heart icon on any song to add it to your collection.
							</p>
						</div>
					)}
				</div>
			)}
		</>
	);
}
