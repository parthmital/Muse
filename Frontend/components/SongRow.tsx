"use client";

import { useMemo } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { TrackInfo } from "@/components/TrackInfo";
import { useSongActions } from "@/hooks/useContextMenu";
import { usePlaylistManager } from "@/hooks/usePlaylistManager";
import { usePlayer } from "@/context/PlayerContext";
import { DynamicActionMenu } from "@/components/DynamicActionMenu";

export interface Song {
	title: string;
	artist: string;
	album: string;
	duration: string;
	img: string;
	liked: boolean;
	// Tidal integration fields (optional, backward-compatible)
	tidalId?: number;
	tidalArtistId?: number;
	tidalAlbumId?: number;
	streamUrl?: string;
	imageId?: string;
	videoCover?: string;
}

export const GRID_COLUMNS_WITH_ALBUM = "grid-cols-song-list-6";
export const GRID_COLUMNS_WITHOUT_ALBUM = "grid-cols-song-list-5";

export function SongRow({
	song,
	index,
	hideAlbum = false,
	liked: propLiked,
	inLibrary: propInLibrary,
	onToggleLike,
	onToggleLibrary,
}: {
	song: Song;
	index: number;
	hideAlbum?: boolean;
	liked?: boolean;
	inLibrary?: boolean;
	onToggleLike?: () => void;
	onToggleLibrary?: () => void;
}) {
	const { playTrack, currentTrack, isPlaying } = usePlayer();

	// Use song title + artist as unique key
	const songKey = `${song.title}-${song.artist}`;

	const isCurrentTrack =
		currentTrack?.title === song.title && currentTrack?.artist === song.artist;

	const {
		isLiked: checkIsLiked,
		toggleLike,
		isInLibrary: checkInLibrary,
		toggleLibrary,
	} = useSongActions();
	const { isSongInPlaylist, toggleSongInPlaylist } = usePlaylistManager();

	// Derive state from props or hooks
	const isLiked = useMemo(() => {
		if (propLiked !== undefined) return propLiked;
		return checkIsLiked(songKey, song.liked);
	}, [propLiked, checkIsLiked, songKey, song.liked]);

	const inLibrary = useMemo(() => {
		if (propInLibrary !== undefined) return propInLibrary;
		return checkInLibrary(songKey);
	}, [propInLibrary, checkInLibrary, songKey]);

	const gridClass = hideAlbum
		? GRID_COLUMNS_WITHOUT_ALBUM
		: GRID_COLUMNS_WITH_ALBUM;

	const handleToggleLike = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (onToggleLike) {
			onToggleLike();
		} else {
			toggleLike(songKey);
		}
	};

	const handleToggleLibrary = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (onToggleLibrary) {
			onToggleLibrary();
		} else {
			toggleLibrary(songKey);
		}
	};

	return (
		<DynamicActionMenu
			type="track"
			id={String(song.tidalId)}
			song={song}
			openOnClick={false}
			trigger={
				<div
					// content-visibility skips render/layout work for off-screen rows —
					// cheap windowing for long track lists without a virtualization dep.
					className={`group/row grid cursor-pointer items-center gap-6 rounded-lg px-4 py-2 transition-colors [content-visibility:auto] [contain-intrinsic-size:0_56px] ${
						isCurrentTrack && isPlaying
							? "bg-neutral-900"
							: "hover:bg-neutral-900"
					} ${gridClass}`}
					onClick={() => playTrack(song)}
				>
					<div className="relative flex h-10 w-10 items-center justify-center">
						<div
							className={`absolute inset-0 flex items-center justify-center transition-opacity ${
								isCurrentTrack && isPlaying
									? "opacity-100"
									: "opacity-0 group-hover/row:opacity-100"
							}`}
						>
							<IconButton
								icon={isCurrentTrack && isPlaying ? "Pause" : "Play Simple"}
								alt="Play"
								ariaLabel={
									isCurrentTrack && isPlaying
										? `Pause ${song.title}`
										: `Play ${song.title}`
								}
								ariaPressed={isCurrentTrack && isPlaying}
								noHover
								onClick={(e) => {
									e.stopPropagation();
									playTrack(song);
								}}
							/>
						</div>
						<span
							className={`transition-opacity ${
								isCurrentTrack && isPlaying
									? "opacity-0"
									: "opacity-100 group-hover/row:opacity-0"
							} ${
								isCurrentTrack && isPlaying
									? "font-bold text-white"
									: "text-neutral-400"
							}`}
						>
							{index + 1}
						</span>
					</div>

					<div className="min-w-0">
						<TrackInfo
							image={song.img}
							title={song.title}
							artist={song.artist}
						/>
					</div>

					{!hideAlbum && (
						<div className="line-clamp-1 min-w-0">{song.album}</div>
					)}

					<div>{song.duration}</div>

					<div className="flex justify-center">
						<IconButton
							icon="Like"
							alt="Like"
							ariaLabel={isLiked ? "Unlike" : "Like"}
							ariaPressed={isLiked}
							filled={isLiked}
							onClick={handleToggleLike}
						/>
					</div>

					<div className="flex items-center gap-6">
						<div
							className={`flex items-center gap-6 transition-opacity ${
								isCurrentTrack && isPlaying
									? "pointer-events-auto opacity-100"
									: "pointer-events-none opacity-0 group-hover/row:pointer-events-auto group-hover/row:opacity-100"
							}`}
						>
							<DynamicActionMenu
								type="track"
								id={String(song.tidalId)}
								trigger={
									<IconButton icon="More" alt="More" ariaLabel="More options" />
								}
								song={song}
							/>
						</div>
						<IconButton
							icon="Check"
							alt="Check"
							ariaLabel={inLibrary ? "Remove from library" : "Add to library"}
							ariaPressed={inLibrary}
							filled={inLibrary}
							onClick={handleToggleLibrary}
							className={
								inLibrary || (isCurrentTrack && isPlaying)
									? "opacity-100"
									: "opacity-0 group-hover/row:opacity-100"
							}
						/>
					</div>
				</div>
			}
		/>
	);
}
