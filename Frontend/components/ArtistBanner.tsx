"use client";

import { FallbackImage } from "@/components/ui/FallbackImage";
import { IconButton } from "@/components/ui/IconButton";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { useLibraryManager } from "@/hooks/useLibraryManager";
import { usePlayer } from "@/context/PlayerContext";
import { DynamicActionMenu } from "@/components/DynamicActionMenu";
import { useMemo } from "react";
import { Song } from "@/components/SongRow";

interface ArtistBannerProps {
	id: string; // TIDAL ID
	title: string;
	listenerCount: string;
	onPlay?: () => void;
	artistSongs?: Song[];
	artistPicture?: string;
}

export function ArtistBanner({
	id,
	title,
	listenerCount,
	onPlay,
	artistSongs = [],
	artistPicture,
}: ArtistBannerProps) {
	const { currentTrack, isPlaying } = usePlayer();
	const { libraryArtists, toggleArtistInLibrary } = useLibraryManager();

	const isFollowing = libraryArtists[title] ?? false;

	const isThisArtistPlaying = useMemo(
		() =>
			isPlaying &&
			currentTrack &&
			artistSongs.some(
				(s) =>
					s.title === currentTrack.title && s.artist === currentTrack.artist,
			),
		[isPlaying, currentTrack, artistSongs],
	);

	const toggleFollow = () => {
		toggleArtistInLibrary(title);
	};

	const playIcon = isThisArtistPlaying ? "Pause" : "Play";

	return (
		<div className="relative h-96 w-full overflow-hidden rounded-lg p-6">
			<FallbackImage
				src={artistPicture || ""}
				alt={title}
				fill
				sizes="100vw"
				className="object-cover"
				priority
				loading="eager"
				fallbackType="Artist"
			/>
			<div className="absolute inset-0 bg-linear-to-t from-neutral-800 via-neutral-800/40 to-transparent" />

			<div className="absolute right-6 bottom-6 left-6 flex items-end justify-between">
				<div className="flex flex-col gap-4">
					<h1 className="text-5xl font-black text-white">{title}</h1>
					<p className="font-medium text-white">
						{listenerCount} monthly listeners
					</p>
				</div>

				<div className="flex items-center gap-3">
					<IconButton
						icon={playIcon}
						alt={isThisArtistPlaying ? "Pause" : "Play"}
						filled
						onClick={onPlay}
					/>
					<IconButton
						icon={isFollowing ? "Check" : "Add"}
						alt={isFollowing ? "Unfollow" : "Follow"}
						filled={isFollowing}
						onClick={toggleFollow}
					/>
					<DynamicActionMenu
						type="artist"
						id={id}
						trigger={<IconButton icon="More" alt="More" />}
					/>
				</div>
			</div>
		</div>
	);
}
