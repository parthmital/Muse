"use client";

import { useState, use } from "react";

import { ArtistBanner } from "./components/ArtistBanner";
import { ArtistTabs } from "./components/ArtistTabs";
import { usePlayer } from "@/context/PlayerContext";
import { ArtistHomeContent } from "./components/ArtistHomeContent";
import { ArtistMediaContent, Album } from "./components/ArtistMediaContent";
import { ArtistSidebar } from "./components/ArtistSidebar";

const TABS = [
	"Home",
	"Albums",
	"Singles and EPs",
	"Compilations",
	"Features & More",
];

const MOCK_ALBUMS: Album[] = [
	{
		title: "Random Access Memories",
		year: "2013",
		img: "/images/Random Access Memories.png",
		songsCount: 13,
	},
	{
		title: "Tron: Legacy",
		year: "2010",
		img: "/images/Discovery.png",
		songsCount: 22,
	},
	{
		title: "Alive 2007",
		year: "2007",
		img: "/images/Discovery.png",
		songsCount: 12,
	},
	{
		title: "Human After All",
		year: "2005",
		img: "/images/Discovery.png",
		songsCount: 10,
	},
	{
		title: "Discovery",
		year: "2001",
		img: "/images/Discovery.png",
		songsCount: 14,
	},
	{
		title: "Homework",
		year: "1997",
		img: "/images/Discovery.png",
		songsCount: 16,
	},
];

const MOCK_SINGLES: Album[] = [
	{
		title: "Get Lucky (Remixes)",
		year: "2013",
		img: "/images/Random Access Memories.png",
		songsCount: 4,
	},
	{
		title: "One More Time",
		year: "2000",
		img: "/images/Discovery.png",
		songsCount: 3,
	},
];

const MOCK_COMPILATIONS: Album[] = [
	{
		title: "Musique Vol. 1 1993–2005",
		year: "2006",
		img: "/images/Discovery.png",
		songsCount: 15,
	},
];

const MOCK_FEATURES: Album[] = [
	{
		title: "Starboy",
		year: "2016",
		img: "/images/Discovery.png",
		songsCount: 18,
	},
];

import { ALL_SONGS } from "@/data/songs";

const BIOGRAPHY =
	'Daft Punk was a highly influential French electronic music duo consisting of Thomas Bangalter and Guy-Manuel de Homem-Christo. Emerging in the 1990s French house scene, they became global icons known for their robot personas and groundbreaking albums like Homework, Discovery, and the Grammy-winning Random Access Memories. Over a three-decade career, they redefined dance music with hits like "Around the World," "One More Time," and "Get Lucky."';
const TAGS = [
	"Funk",
	"Electronic music",
	"Disco",
	"Soft Rock",
	"Progressive pop",
];

export default function ArtistPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const title = decodeURIComponent(id);

	// Filter songs for this artist from the central list
	const artistSongs = ALL_SONGS.filter((s) => s.artist === title);
	// derive most played and popular from artistSongs
	const mostPlayed =
		artistSongs.length > 0 ? artistSongs.slice(0, 5) : ALL_SONGS.slice(0, 5);
	const popular = (
		artistSongs.length > 0 ? artistSongs : ALL_SONGS.slice(0, 5)
	).map((s) => ({ ...s, streams: "1,234,567,890" }));
	const { playTrack } = usePlayer();

	const [activeTab, setActiveTab] = useState("Home");
	const [isSearchActive, setIsSearchActive] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [viewMode, setViewMode] = useState<"Grid" | "List">("Grid");

	const filteredMostPlayed = mostPlayed.filter((song) =>
		song.title.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	const filteredPopular = popular.filter((song) =>
		song.title.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	const filterAlbum = (album: Album) =>
		album.title.toLowerCase().includes(searchQuery.toLowerCase());

	const filteredAlbums = MOCK_ALBUMS.filter(filterAlbum);
	const filteredSingles = MOCK_SINGLES.filter(filterAlbum);
	const filteredCompilations = MOCK_COMPILATIONS.filter(filterAlbum);
	const filteredFeatures = MOCK_FEATURES.filter(filterAlbum);

	const handlePlayArtist = () => {
		if (artistSongs.length > 0) {
			playTrack(artistSongs[0]);
		}
	};

	return (
		<div className="flex flex-col">
			<ArtistBanner
				title={title}
				listenerCount="20,795,080"
				onPlay={handlePlayArtist}
				artistSongs={artistSongs}
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
					<ArtistSidebar biography={BIOGRAPHY} tags={TAGS} />
				)}
			</div>
		</div>
	);
}
