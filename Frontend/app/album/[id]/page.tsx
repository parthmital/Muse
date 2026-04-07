"use client";

import { useState, use, useMemo, useEffect } from "react";
import { FallbackImage } from "@/components/ui/FallbackImage";
import { Song, SongRow } from "@/components/SongRow";
import { SongListHeader } from "@/components/SongListHeader";
import { IconButton } from "@/components/ui/IconButton";
import { SearchInput } from "@/components/ui/SearchInput";
import { ActionMenu, ActionMenuItem } from "@/components/ui/ActionMenu";

import { useSongActions } from "@/hooks/useContextMenu";
import { useSorting } from "@/hooks/useSorting";
import { usePlayer } from "@/context/PlayerContext";
import { formatTotalDuration } from "@/utils/duration";
import { DynamicActionMenu } from "@/components/DynamicActionMenu";

import { getAlbum } from "@/lib/api";
import { tidalTrackToSong } from "@/lib/tidalAdapter";

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

	const { playTrack, playPlaylist, currentTrack, isPlaying } = usePlayer();

	const [albumData, setAlbumData] = useState<any>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getAlbum(Number(id))
			.then((data) => {
				setAlbumData(data);
				setIsLoading(false);
			})
			.catch(() => setIsLoading(false));
	}, [id]);

	const albumSongs = albumData ? albumData.tracks.map(tidalTrackToSong) : [];
	const displaySongs = albumSongs;

	const [isSearchActive, setIsSearchActive] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	// Since library logic was moved to backend, we ignore local library fetching
	const libraryAlbums: Record<string, boolean> = {};

	const {
		isInitialized,
		toggleLike,
		toggleLibrary: toggleSongLibrary,
		isLiked,
		isInLibrary,
	} = useSongActions();

	const allInitialized = isInitialized;

	const inLibrary = useMemo(
		() => libraryAlbums[title] ?? false,
		[libraryAlbums, title],
	);

	const filteredSongs = displaySongs.filter(
		(song: Song) =>
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
				(s: any) =>
					s.title === currentTrack.title && s.artist === currentTrack.artist,
			),
		[isPlaying, currentTrack, displaySongs],
	);

	const handlePlayAll = () => {
		if (sortedSongs.length > 0) {
			playPlaylist(sortedSongs);
		}
	};

	const toggleAlbumLibrary = () => {
		// Using the backend library action manager logic instead.
		// For now just console log.
		console.log(`${title} album library toggled.`);
	};

	const playIcon = isThisAlbumPlaying ? "Pause" : "Play";

	return (
		<div className="flex gap-6">
			{/* Left Column: Album Content */}
			<div className="flex min-w-0 flex-1 flex-col gap-6">
				<div className="flex flex-col gap-6">
					<h1 className="text-4xl font-bold text-white">
						{albumData?.album?.title || title}
					</h1>
					<div className="flex items-center gap-2">
						<span className="font-medium text-white">
							{albumData?.album?.artist?.name || "Artist"}
						</span>
						<span>•</span>
						<span>
							{albumData?.album?.releaseDate?.substring(0, 4) || "Year"}
						</span>
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
					<DynamicActionMenu
						type="album"
						id={id}
						trigger={<IconButton icon="More" alt="More" />}
						song={{ artistId: albumData?.album?.artist?.id }}
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
						src={albumData?.album?.cover || ""}
						alt={title}
						fill
						sizes="320px"
						className="rounded-lg object-cover"
						priority
						loading="eager"
						fallbackType="Album"
					/>
				</div>

				<div className="flex flex-col gap-6">
					<div className="flex flex-col gap-4">
						<div className="flex items-center gap-3">
							<div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-neutral-800">
								<FallbackImage
									src={albumData?.album?.artist?.picture || ""}
									alt={"Artist"}
									fill
									sizes="48px"
									className="object-cover"
									fallbackType="Artist"
								/>
							</div>
							<span className="text-base font-medium">
								{albumData?.album?.artist?.name || "Artist"}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
