"use client";

import { FallbackImage } from "@/components/ui/FallbackImage";
import { IconButton } from "@/components/ui/IconButton";
import { DynamicActionMenu } from "@/components/DynamicActionMenu";
import { useLibraryManager } from "@/hooks/useLibraryManager";
import { useMediaActions } from "@/hooks/useMediaActions";
import { usePlayer } from "@/context/PlayerContext";
import { getAlbum } from "@/lib/api";
import { tidalTrackToSong } from "@/lib/tidalAdapter";
import type { Song } from "@/components/SongRow";

interface AlbumListItemProps {
	id: string; // TIDAL ID
	title: string;
	year: string;
	img: string;
	songsCount: number;
}

export function AlbumListItem({
	id,
	title,
	year,
	img,
	songsCount,
}: AlbumListItemProps) {
	const { libraryAlbums, toggleAlbumInLibrary } = useLibraryManager();
	const { playPlaylist, playShuffled, addManyToQueue } = usePlayer();
	const { share, download } = useMediaActions();

	const inLibrary = libraryAlbums[title] ?? false;

	const toggleLibrary = () => {
		toggleAlbumInLibrary(title);
	};

	// AlbumListItem only has the album id; fetch its tracks on demand for
	// play/shuffle/queue actions.
	const loadSongs = async (): Promise<Song[]> => {
		try {
			const data = await getAlbum(Number(id));
			return data.tracks.map(tidalTrackToSong);
		} catch {
			return [];
		}
	};

	const handlePlay = async () => {
		const songs = await loadSongs();
		if (songs.length) playPlaylist(songs);
	};

	const handleShuffle = async () => {
		const songs = await loadSongs();
		if (songs.length) playShuffled(songs);
	};

	const handleAddToQueue = async () => {
		const songs = await loadSongs();
		if (songs.length) addManyToQueue(songs);
	};

	return (
		<div className="flex cursor-pointer items-center gap-6">
			<div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-lg">
				<FallbackImage
					src={img}
					alt={title}
					fill
					sizes="128px"
					className="object-cover"
					fallbackType="Album"
				/>
			</div>
			<div className="flex flex-col gap-3">
				<h3 className="truncate text-xl font-bold text-white">{title}</h3>
				<div className="flex items-center gap-2 text-sm text-neutral-400">
					<span>{year}</span>
					<span>•</span>
					<span>{songsCount} songs</span>
				</div>
				<div className="flex items-center gap-3">
					<IconButton icon="Play" alt="Play" filled onClick={handlePlay} />
					<IconButton icon="Shuffle" alt="Shuffle" onClick={handleShuffle} />
					<IconButton
						icon={inLibrary ? "Check" : "Add"}
						alt={inLibrary ? "In Library" : "Add to Library"}
						filled={inLibrary}
						onClick={toggleLibrary}
					/>
					<IconButton
						icon="Add to Queue"
						alt="Add to Queue"
						onClick={handleAddToQueue}
					/>
					<IconButton
						icon="Download"
						alt="Download"
						onClick={() => download()}
					/>
					<IconButton icon="Share" alt="Share" onClick={() => share(title)} />
					<DynamicActionMenu
						type="album"
						id={id}
						trigger={<IconButton icon="More" alt="More" />}
					/>
				</div>
			</div>
		</div>
	);
}
