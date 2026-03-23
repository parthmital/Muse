"use client";

import { useState, use, useEffect } from "react";

import { ArtistBanner } from "@/components/ArtistBanner";
import { ArtistTabs } from "@/components/ArtistTabs";
import { usePlayer } from "@/context/PlayerContext";
import { Song } from "@/components/SongRow";
import { ArtistHomeContent } from "@/components/ArtistHomeContent";
import { ArtistMediaContent, Album } from "@/components/ArtistMediaContent";
import { ArtistSidebar } from "@/components/ArtistSidebar";

const TABS = [
	"Home",
	"Albums",
	"Singles and EPs",
	"Compilations",
	"Features & More",
];

import { getArtist } from "@/lib/api";
import { tidalAlbumToMediaItem, tidalTrackToSong } from "@/lib/tidalAdapter";

export default function ArtistPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const title = decodeURIComponent(id);

	const [artistData, setArtistData] = useState<any>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getArtist(Number(id))
			.then((data) => {
				setArtistData(data);
				setIsLoading(false);
			})
			.catch(() => {
				setIsLoading(false);
			});
	}, [id]);

	const artistSongs = artistData
		? artistData.topTracks.map(tidalTrackToSong)
		: [];
	const mostPlayed = artistSongs.slice(0, 5);
	const popular = artistSongs;
	const { playTrack } = usePlayer();

	const [activeTab, setActiveTab] = useState("Home");
	const [isSearchActive, setIsSearchActive] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [viewMode, setViewMode] = useState<"Grid" | "List">("Grid");

	const filteredMostPlayed = mostPlayed.filter((song: Song) =>
		song.title.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	const filteredPopular = popular.filter((song: Song) =>
		song.title.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	const albumsRaw = artistData?.albums || [];
	const mappedAlbums = albumsRaw.map((a: any) => ({
		id: String(a.id || a.tidalId || ""),
		title: a.title,
		year: a.releaseDate?.substring(0, 4) || "",
		img: a.cover,
		songsCount: a.numberOfTracks || 0,
	}));

	const filterAlbum = (album: any) =>
		album.title.toLowerCase().includes(searchQuery.toLowerCase());

	const filteredAlbums = mappedAlbums.filter(filterAlbum);
	const filteredSingles: any[] = [];
	const filteredCompilations: any[] = [];
	const filteredFeatures: any[] = [];

	const handlePlayArtist = () => {
		if (artistSongs.length > 0) {
			playTrack(artistSongs[0]);
		}
	};

	return (
		<div className="flex flex-col">
			<ArtistBanner
				id={id}
				title={title}
				listenerCount="20,795,080"
				onPlay={handlePlayArtist}
				artistSongs={artistSongs}
				artistPicture={artistData?.artist?.picture}
			/>

			<ArtistTabs
				tabs={TABS}
				activeTab={activeTab}
				onTabChange={setActiveTab}
				isSearchActive={isSearchActive}
				setIsSearchActive={setIsSearchActive}
				viewMode={viewMode}
				onViewModeChange={setViewMode}
				onSearchChange={setSearchQuery}
			/>

			{/* Main Content Layout */}
			<div className="flex gap-6 p-6">
				{/* Left Column: Music Content */}
				<div className="flex min-w-0 flex-1 flex-col gap-6">
					{activeTab === "Home" && (
						<ArtistHomeContent
							mostPlayed={filteredMostPlayed}
							popular={filteredPopular}
						/>
					)}

					{activeTab === "Albums" && (
						<ArtistMediaContent items={filteredAlbums} viewMode={viewMode} />
					)}

					{activeTab === "Singles and EPs" && (
						<ArtistMediaContent items={filteredSingles} viewMode={viewMode} />
					)}

					{activeTab === "Compilations" && (
						<ArtistMediaContent
							items={filteredCompilations}
							viewMode={viewMode}
						/>
					)}

					{activeTab === "Features & More" && (
						<ArtistMediaContent items={filteredFeatures} viewMode={viewMode} />
					)}
				</div>

				{/* Right Column: Sidebar */}
				{![
					"Albums",
					"Singles and EPs",
					"Compilations",
					"Features & More",
				].includes(activeTab) && (
					<ArtistSidebar
						biography={""}
						tags={artistData?.artist?.artistTypes || []}
						artistPicture={artistData?.artist?.picture}
					/>
				)}
			</div>
		</div>
	);
}
