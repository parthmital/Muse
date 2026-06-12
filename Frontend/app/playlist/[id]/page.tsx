"use client";

import { useState, use, useMemo, useEffect } from "react";
import { FallbackImage } from "@/components/ui/FallbackImage";
import { Song, SongRow } from "@/components/SongRow";
import { SongListHeader } from "@/components/SongListHeader";
import { IconButton } from "@/components/ui/IconButton";
import { SearchInput } from "@/components/ui/SearchInput";

import { useSongActions } from "@/hooks/useContextMenu";
import { useLibraryManager } from "@/hooks/useLibraryManager";
import { useSorting } from "@/hooks/useSorting";
import { usePlayer } from "@/context/PlayerContext";
import { formatTotalDuration } from "@/utils/duration";
import { DynamicActionMenu } from "@/components/DynamicActionMenu";

import { getPlaylist, TidalPlaylist, TidalTrack } from "@/lib/api";
import { tidalTrackToSong } from "@/lib/tidalAdapter";
import { trackKey } from "@/lib/trackKey";

interface PlaylistData {
	playlist: TidalPlaylist;
	tracks: TidalTrack[];
}

const SONG_COMPARATORS: Record<string, (a: Song, b: Song) => number> = {
	title: (a, b) => a.title.localeCompare(b.title),
	artist: (a, b) => a.artist.localeCompare(b.artist),
	album: (a, b) => a.album.localeCompare(b.album),
	duration: (a, b) => a.duration.localeCompare(b.duration),
};

export default function PlaylistPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const title = decodeURIComponent(id);

	const {
		playPlaylist,
		playShuffled,
		addManyToQueue,
		currentTrack,
		isPlaying,
	} = usePlayer();
	const { libraryPlaylists, togglePlaylistInLibrary } = useLibraryManager();

	const [playlistData, setPlaylistData] = useState<PlaylistData | null>(null);
	const [, setIsLoading] = useState(true);

	useEffect(() => {
		getPlaylist(id)
			.then((data) => {
				setPlaylistData(data);
				setIsLoading(false);
			})
			.catch(() => setIsLoading(false));
	}, [id]);

	const playlistSongs = playlistData
		? playlistData.tracks.map(tidalTrackToSong)
		: [];
	const [isSearchActive, setIsSearchActive] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");

	const {
		isInitialized,
		toggleLike,
		toggleLibrary: toggleSongLibrary,
		isLiked,
		isInLibrary,
	} = useSongActions();

	const allInitialized = isInitialized;

	const inLibrary = useMemo(
		() => libraryPlaylists[title] ?? false,
		[libraryPlaylists, title],
	);

	const filteredSongs = playlistSongs.filter(
		(song: Song) =>
			song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
			song.album.toLowerCase().includes(searchQuery.toLowerCase()),
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

	const formattedDuration = formatTotalDuration(playlistSongs);

	const isThisPlaylistPlaying = useMemo(
		() =>
			isPlaying &&
			currentTrack &&
			playlistSongs.some(
				(s: Song) =>
					s.title === currentTrack.title && s.artist === currentTrack.artist,
			),
		[isPlaying, currentTrack, playlistSongs],
	);

	const handlePlayAll = () => {
		if (sortedSongs.length > 0) {
			playPlaylist(sortedSongs);
		}
	};

	const toggleLibrary = () => {
		togglePlaylistInLibrary(title);
	};

	const playIcon = isThisPlaylistPlaying ? "Pause" : "Play";

	return (
		<>
			{/* Mobile-only header — matches the reference Playlist top bar. */}
			<div className="flex items-center gap-3 md:hidden">
				<div className="flex grow items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-white">
					<input
						type="text"
						placeholder="Search playlist"
						aria-label="Search playlist"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="grow bg-transparent outline-none placeholder:text-neutral-500"
					/>
					<IconButton icon="Search" alt="Search" filled noHover />
				</div>
				<IconButton
					icon="Sort"
					alt="Sort"
					ariaLabel="Sort"
					onClick={() => handleSort("title")}
				/>
			</div>

			<div className="flex flex-col gap-6 lg:flex-row">
				{/* Left Column: Playlist Content */}
				<div className="flex min-w-0 flex-1 flex-col gap-6">
					<div className="flex flex-col gap-3 md:gap-6">
						<h1 className="text-2xl font-bold text-white md:text-4xl">
							{playlistData?.playlist?.title || title}
						</h1>
						<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm md:text-base">
							<span>
								By{" "}
								<span className="font-medium text-white">
									{playlistData?.playlist?.creator?.name || "TIDAL"}
								</span>
							</span>
							<span>•</span>
							<span>{playlistSongs.length} songs</span>
							<span>•</span>
							<span>{formattedDuration}</span>
						</div>
					</div>

					<div className="flex items-center gap-3">
						<IconButton
							icon={playIcon}
							alt={isThisPlaylistPlaying ? "Pause" : "Play"}
							filled
							onClick={handlePlayAll}
						/>
						<IconButton
							icon="Shuffle"
							alt="Shuffle"
							onClick={() => playShuffled(sortedSongs)}
						/>
						<IconButton
							icon={inLibrary ? "Check" : "Add"}
							alt={inLibrary ? "In Library" : "Add to Library"}
							filled={inLibrary}
							onClick={toggleLibrary}
						/>
						<IconButton
							icon="Add to Queue"
							alt="Add to Queue"
							onClick={() => addManyToQueue(sortedSongs)}
							className="hidden md:flex"
						/>
						<DynamicActionMenu
							type="playlist"
							id={id}
							trigger={<IconButton icon="More" alt="More" />}
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
								const songKey = trackKey(song);
								return (
									<SongRow
										key={`${song.title}-${index}`}
										song={song}
										index={index}
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

				{/* Right Column: Sidebar (stacks on top on mobile) */}
				<div className="order-first flex w-full shrink-0 flex-col gap-6 lg:order-none lg:w-80">
					<div className="relative aspect-square w-full lg:mx-0 lg:max-w-none">
						<FallbackImage
							src={playlistData?.playlist?.image || ""}
							alt={title}
							fill
							sizes="(max-width: 1024px) 20rem, 320px"
							className="rounded-lg object-cover"
							priority
							fallbackType="Playlist"
						/>
					</div>

					<div className="flex flex-col gap-6">
						<div className="flex flex-wrap gap-3"></div>

						<div className="flex flex-col gap-4">
							<div className="flex items-center gap-3">
								<div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-neutral-800">
									<FallbackImage
										src={playlistData?.playlist?.creator?.picture || ""}
										alt={"Creator"}
										fill
										sizes="48px"
										className="object-cover"
										fallbackType="Artist"
									/>
								</div>
								<span className="text-base font-medium">
									{playlistData?.playlist?.creator?.name || "TIDAL"}
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
