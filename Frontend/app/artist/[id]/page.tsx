"use client";

import { useState, use, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { ArtistBanner } from "@/components/ArtistBanner";
import { ArtistTabs } from "@/components/ArtistTabs";
import { usePlayer } from "@/context/PlayerContext";
import { Song } from "@/components/SongRow";
import { ArtistHomeContent } from "@/components/ArtistHomeContent";
import { ArtistMediaContent, Album } from "@/components/ArtistMediaContent";
import { ArtistSidebar } from "@/components/ArtistSidebar";

const TABS = ["Home", "Albums", "Singles and EPs"];

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

	const searchParams = useSearchParams();
	const router = useRouter();

	const [activeTab, setActiveTab] = useState(() => {
		const tabFromUrl = searchParams.get("tab");
		return tabFromUrl && TABS.includes(tabFromUrl) ? tabFromUrl : "Home";
	});

	// Sync tab state to URL
	useEffect(() => {
		const currentTab = searchParams.get("tab");
		if (activeTab !== "Home" && currentTab !== activeTab) {
			const params = new URLSearchParams(searchParams.toString());
			params.set("tab", activeTab);
			router.replace(`?${params.toString()}`, { scroll: false });
		} else if (activeTab === "Home" && currentTab) {
			const params = new URLSearchParams(searchParams.toString());
			params.delete("tab");
			router.replace(`?${params.toString()}`, { scroll: false });
		}
	}, [activeTab, searchParams, router]);

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

	// Deduplicate by ID
	const seenIds = new Set<string>();
	const uniqueAlbums = albumsRaw.filter((a: any) => {
		const id = String(a.id || a.tidalId || "");
		if (seenIds.has(id)) return false;
		seenIds.add(id);
		return true;
	});

	// Sort by release date (newest first)
	const sortedAlbums = uniqueAlbums.sort((a: any, b: any) => {
		const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
		const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
		return dateB - dateA;
	});

	const mappedAlbums = sortedAlbums.map((a: any) => ({
		id: String(a.id || a.tidalId || ""),
		title: a.title,
		year: a.releaseDate?.substring(0, 4) || "",
		img: a.cover,
		songsCount: a.numberOfTracks || 0,
		type: a.type || "ALBUM",
	}));

	const filterAlbum = (album: any) =>
		album.title.toLowerCase().includes(searchQuery.toLowerCase());

	const filteredAlbums = mappedAlbums.filter(
		(album: any) => filterAlbum(album) && album.type === "ALBUM",
	);
	const filteredSingles = mappedAlbums.filter(
		(album: any) =>
			filterAlbum(album) && (album.type === "SINGLE" || album.type === "EP"),
	);

	const handlePlayArtist = () => {
		if (artistSongs.length > 0) {
			playTrack(artistSongs[0]);
		}
	};

	return (
		<div className="flex flex-col">
			<ArtistBanner
				id={id}
				title={artistData?.artist?.name || title}
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
				</div>

				{/* Right Column: Sidebar */}
				{!["Albums", "Singles and EPs"].includes(activeTab) && (
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
