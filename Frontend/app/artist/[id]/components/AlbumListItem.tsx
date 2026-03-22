"use client";

import { FallbackImage } from "@/components/ui/FallbackImage";
import { IconButton } from "@/components/ui/IconButton";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { useLibraryManager } from "@/hooks/useLibraryManager";

interface AlbumListItemProps {
	title: string;
	year: string;
	img: string;
	songsCount: number;
}

export function AlbumListItem({
	title,
	year,
	img,
	songsCount,
}: AlbumListItemProps) {
	const { libraryAlbums, toggleAlbumInLibrary } = useLibraryManager();

	const inLibrary = libraryAlbums[title] ?? false;

	const toggleLibrary = () => {
		toggleAlbumInLibrary(title);
	};
	return (
		<div className="flex cursor-pointer items-center gap-6">
			<div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-lg">
				<FallbackImage
					src={img}
					alt={title}
					fill
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
					<span>•</span>
					<span>48 min 26 sec</span>
				</div>
				<div className="flex items-center gap-3">
					<IconButton icon="Play" alt="Play" filled />
					<IconButton icon="Shuffle" alt="Shuffle" />
					<IconButton
						icon={inLibrary ? "Check" : "Add"}
						alt={inLibrary ? "In Library" : "Add to Library"}
						filled={inLibrary}
						onClick={toggleLibrary}
					/>
					<IconButton icon="Add to Queue" alt="Add to Queue" />
					<IconButton icon="Download" alt="Download" />
					<IconButton icon="Share" alt="Share" />
					<ActionMenu
						trigger={<IconButton icon="More" alt="More" />}
						items={[
							{
								label: "Go to Artist",
								icon: "User",
								onClick: () => console.log("Go to Artist"),
							},
						]}
					/>
				</div>
			</div>
		</div>
	);
}
