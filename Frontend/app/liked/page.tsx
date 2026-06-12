"use client";

import { useState } from "react";
import { FilterBar } from "@/components/FilterBar";
import { Song, SongRow } from "@/components/SongRow";
import { SongListHeader } from "@/components/SongListHeader";
import { useSongActions } from "@/hooks/useContextMenu";
import { useSorting } from "@/hooks/useSorting";
import { durationToSeconds } from "@/utils/duration";
import { API_BASE, swrFetcher, getTrackInfo } from "@/lib/api";
import { tidalTrackToSong } from "@/lib/tidalAdapter";
import { trackKey, isResolvableTrackKey } from "@/lib/trackKey";

import useSWR from "swr";

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

	const { isInitialized, toggleLike, toggleLibrary, isLiked, isInLibrary } =
		useSongActions();

	// Liked tracks are stored in the library as `liked_track` rows keyed by the
	// Tidal id; resolve each id to a full track for display.
	const { data: libraryData } = useSWR<{
		library: { itemType: string; itemId: string }[];
	}>(`${API_BASE}/library`, swrFetcher);

	const likedIds = (libraryData?.library ?? [])
		.filter((i) => i.itemType === "liked_track")
		.map((i) => i.itemId)
		.filter(isResolvableTrackKey);

	const { data: likedSongs, isLoading: songsLoading } = useSWR(
		libraryData ? ["liked-songs", likedIds.join(",")] : null,
		async (): Promise<Song[]> => {
			const resolved = await Promise.all(
				likedIds.map((id) =>
					getTrackInfo(Number(id))
						.then((t) => ({ ...tidalTrackToSong(t), liked: true }))
						.catch(() => null),
				),
			);
			return resolved.filter((s): s is Song => s !== null);
		},
	);

	const filteredSongs = (likedSongs ?? []).filter(
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

	const loading = !isInitialized || !libraryData || songsLoading;

	return (
		<>
			<h1 className="text-2xl font-bold text-white md:hidden">Liked Songs</h1>
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

			{loading ? (
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
							const songKey = trackKey(song);
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
