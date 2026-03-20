"use client";

import { useState, use, useMemo } from "react";
import { FallbackImage } from "@/components/ui/FallbackImage";
import { Song, SongRow } from "@/components/SongRow";
import { SongListHeader } from "@/components/SongListHeader";
import { IconButton } from "@/components/ui/IconButton";
import { SearchInput } from "@/components/ui/SearchInput";
import { ActionMenu, ActionMenuItem } from "@/components/ui/ActionMenu";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSongActions } from "@/hooks/useSongActions";
import { useSorting } from "@/hooks/useSorting";
import { usePlayer } from "@/context/PlayerContext";
import { formatTotalDuration } from "@/utils/duration";

import { ALL_SONGS } from "@/data/songs";

const SONG_COMPARATORS: Record<string, (a: Song, b: Song) => number> = {
	title: (a, b) => a.title.localeCompare(b.title),
	artist: (a, b) => a.artist.localeCompare(b.artist),
	album: (a, b) => a.album.localeCompare(b.album),
	duration: (a, b) => a.duration.localeCompare(b.duration),
};

export default function AlbumPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const title = decodeURIComponent(id);

	const { playTrack, currentTrack, isPlaying } = usePlayer();

	// Filter songs for this album from the central list
	const albumSongs = ALL_SONGS.filter((s) => s.album === title);
	// Fallback to a few songs if none match (for demo purposes)
	const displaySongs =
		albumSongs.length > 0 ? albumSongs : ALL_SONGS.slice(0, 8);
	const [isSearchActive, setIsSearchActive] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [libraryAlbums, setLibraryAlbums] = useLocalStorage<
		Record<string, boolean>
	>("libraryAlbums", {});

	const {
		isInitialized,
		toggleLike,
		toggleLibrary: toggleSongLibrary,
		isLiked,
		isInLibrary,
	} = useSongActions();

	const [, , isInitializedAlbums] = useLocalStorage("libraryAlbums", {});

	const allInitialized = isInitialized && isInitializedAlbums;

	const inLibrary = useMemo(
		() => libraryAlbums[title] ?? false,
		[libraryAlbums, title],
	);

	const filteredSongs = displaySongs.filter(
		(song) =>
			song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			song.artist.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	const {
		sortedItems: sortedSongs,
		sortBy,
		sortOrder,
		handleSort,
	} = useSorting({
		items: filteredSongs,
		comparators: SONG_COMPARATORS,
	});

	const formattedDuration = formatTotalDuration(displaySongs);

	const isThisAlbumPlaying = useMemo(
		() =>
			isPlaying &&
			currentTrack &&
			displaySongs.some(
				(s) =>
					s.title === currentTrack.title && s.artist === currentTrack.artist,
			),
		[isPlaying, currentTrack, displaySongs],
	);

	const handlePlayAll = () => {
		if (sortedSongs.length > 0) {
			playTrack(sortedSongs[0]);
		}
	};

	const toggleAlbumLibrary = () => {
		const newLibraryState = !inLibrary;
		setLibraryAlbums({ ...libraryAlbums, [title]: newLibraryState });
		console.log(
			`${newLibraryState ? "Added to" : "Removed from"} library: ${title}`,
		);
	};

	const albumActions: ActionMenuItem[] = [
		{
			label: "Go to Artist",
			icon: "User",
			onClick: () => console.log("Go to Artist"),
		},
		{
			label: "Edit Album",
			icon: "Edit",
			onClick: () => console.log("Edit Album"),
		},
	];

	const playIcon = isThisAlbumPlaying ? "Pause" : "Play";

	return (
		<div className="flex gap-6">
			{/* Left Column: Album Content */}
			<div className="flex min-w-0 flex-1 flex-col gap-6">
				<div className="flex flex-col gap-6">
					<h1 className="text-4xl font-bold text-white">{title}</h1>
					<div className="flex items-center gap-2">
						<span className="font-medium text-white">Daft Punk</span>
						<span>•</span>
						<span>2005</span>
						<span>•</span>
						<span>{displaySongs.length} songs</span>
						<span>•</span>
						<span>{formattedDuration}</span>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<IconButton
						icon={playIcon}
						alt={isThisAlbumPlaying ? "Pause" : "Play"}
						filled
						onClick={handlePlayAll}
					/>
					<IconButton icon="Shuffle" alt="Shuffle" />
					<IconButton
						icon={inLibrary ? "Check" : "Add"}
						alt={inLibrary ? "In Library" : "Add to Library"}
						filled={inLibrary}
						onClick={toggleAlbumLibrary}
					/>
					<IconButton icon="Add to Queue" alt="Add to Queue" />
					<IconButton icon="Download" alt="Download" />
					<IconButton icon="Share" alt="Share" />
					<ActionMenu
						trigger={<IconButton icon="More" alt="More" />}
						items={albumActions}
					/>

					<div className={isSearchActive ? "grow" : ""}>
						{isSearchActive ? (
							<SearchInput
								autoFocus
								onClose={() => {
									setIsSearchActive(false);
									setSearchQuery("");
								}}
								onChange={setSearchQuery}
								preventNavigation={true}
							/>
						) : (
							<IconButton
								icon="Search"
								alt="Search"
								className="pl-1"
								onClick={() => setIsSearchActive(true)}
							/>
						)}
					</div>
				</div>

				{/* Song List */}
				<div className="flex flex-col gap-2">
					<SongListHeader
						hideAlbum
						sortBy={sortBy}
						sortOrder={sortOrder}
						onSort={handleSort}
					/>
					{!allInitialized ? (
						<div className="py-10 text-center text-neutral-500">
							Loading songs...
						</div>
					) : sortedSongs.length > 0 ? (
						sortedSongs.map((song, index) => {
							const songKey = `${song.title}-${song.artist}`;
							return (
								<SongRow
									key={`${song.title}-${index}`}
									song={song}
									index={index}
									hideAlbum
									liked={isLiked(songKey, song.liked)}
									inLibrary={isInLibrary(songKey)}
									onToggleLike={() => toggleLike(songKey)}
									onToggleLibrary={() => toggleSongLibrary(songKey)}
								/>
							);
						})
					) : (
						<div className="py-10 text-center text-neutral-500">
							No songs found matching &quot;{searchQuery}&quot;
						</div>
					)}
				</div>
			</div>

			{/* Right Column: Sidebar */}
			<div className="flex w-80 shrink-0 flex-col gap-6">
				<div className="relative aspect-square w-full">
					<FallbackImage
						src={`/images/${title}.png`}
						alt={title}
						fill
						className="rounded-lg object-cover"
						priority
						fallbackType="Album"
					/>
				</div>

				<div className="flex flex-col gap-6">
					<div className="flex flex-wrap gap-3">
						{[
							"Funk",
							"Electronic Music",
							"Disco",
							"Soft Rock",
							"Progressive Pop",
						].map((tag) => (
							<span
								key={tag}
								className="rounded-lg border border-neutral-800 px-4 py-2"
							>
								{tag}
							</span>
						))}
					</div>

					<div className="flex flex-col gap-4">
						{["Daft Punk", "Pharrell Williams", "Nile Rodgers"].map(
							(artist) => (
								<div key={artist} className="flex items-center gap-3">
									<div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-neutral-800">
										<FallbackImage
											src={`/images/${artist}.png`}
											alt={artist}
											fill
											className="object-cover"
											fallbackType="Artist"
										/>
									</div>
									<span className="text-base font-medium">{artist}</span>
								</div>
							),
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
