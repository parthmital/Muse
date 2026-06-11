"use client";

import { useState, use, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { ArtistBanner } from "@/components/ArtistBanner";
import { ArtistTabs } from "@/components/ArtistTabs";
import { usePlayer } from "@/context/PlayerContext";
import { Song } from "@/components/SongRow";
import { ArtistHomeContent } from "@/components/ArtistHomeContent";
import { ArtistMediaContent } from "@/components/ArtistMediaContent";
import { ArtistSidebar } from "@/components/ArtistSidebar";
import { useLastFmArtist } from "@/hooks/useLastFmArtist";

const TABS = ["Home", "Albums", "Singles and EPs"];

import { getArtist, TidalAlbum } from "@/lib/api";
import { tidalTrackToSong } from "@/lib/tidalAdapter";

type ArtistData = Awaited<ReturnType<typeof getArtist>>;

export default function ArtistPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const title = decodeURIComponent(id);

	const [artistData, setArtistData] = useState<ArtistData | null>(null);
	const [, setIsLoading] = useState(true);

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

	const artistName = artistData?.artist?.name || title;
	// Only fetch Last.fm data if we have a real artist name (not just an ID)
	const lastFmArtistName = artistData?.artist?.name || null;
	const { info: lastFmInfo } = useLastFmArtist(lastFmArtistName);

	// Format listener count with commas
	const formatNumber = (num: string): string => {
		const n = parseInt(num, 10);
		if (isNaN(n)) return num;
		return n.toLocaleString();
	};

	const listenerCount = lastFmInfo?.listeners
		? formatNumber(lastFmInfo.listeners)
		: undefined;

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

	// Helper to normalize album title (remove version suffixes)
	const normalizeAlbumTitle = (title: string): string => {
		return title
			.replace(
				/\s*\([^)]*\b(?:Deluxe|Extended|Remastered|Explicit|Clean|Standard|Special Edition|Anniversary)\b[^)]*\)/gi,
				"",
			)
			.replace(
				/\s*-\s*(?:Deluxe|Extended|Remastered|Explicit|Clean|Standard|Special Edition|Anniversary).*$/i,
				"",
			)
			.trim();
	};

	// Deduplicate by normalized title + year, keeping the one with most tracks
	const albumGroups = new Map<string, TidalAlbum[]>();
	for (const album of albumsRaw) {
		const normalizedTitle = normalizeAlbumTitle(album.title || "");
		const year = album.releaseDate?.substring(0, 4) || "unknown";
		const key = `${normalizedTitle.toLowerCase()}-${year}`;
		if (!albumGroups.has(key)) {
			albumGroups.set(key, []);
		}
		albumGroups.get(key)!.push(album);
	}

	// For each group, pick the best version (most tracks)
	const uniqueAlbums: TidalAlbum[] = [];
	for (const [, group] of albumGroups) {
		// Sort by number of tracks descending
		group.sort((a, b) => (b.numberOfTracks || 0) - (a.numberOfTracks || 0));
		// Take the first one (most tracks)
		uniqueAlbums.push(group[0]);
	}

	// Sort by release date (newest first)
	const sortedAlbums = uniqueAlbums.sort((a, b) => {
		const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
		const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
		return dateB - dateA;
	});

	const mappedAlbums = sortedAlbums.map((a) => ({
		id: String(a.id || a.tidalId || ""),
		title: a.title,
		year: a.releaseDate?.substring(0, 4) || "",
		img: a.cover ?? "",
		songsCount: a.numberOfTracks || 0,
		type: a.type || "ALBUM",
	}));

	const filterAlbum = (album: (typeof mappedAlbums)[number]) =>
		album.title.toLowerCase().includes(searchQuery.toLowerCase());

	const filteredAlbums = mappedAlbums.filter(
		(album) => filterAlbum(album) && album.type === "ALBUM",
	);
	const filteredSingles = mappedAlbums.filter(
		(album) =>
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
				title={artistName}
				listenerCount={listenerCount}
				onPlay={handlePlayArtist}
				artistSongs={artistSongs}
				artistPicture={artistData?.artist?.picture ?? undefined}
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
			<div className="flex flex-col gap-6 p-6 lg:flex-row">
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
						biography={lastFmInfo?.bio?.summary || ""}
						tags={lastFmInfo?.tags || artistData?.artist?.artistTypes || []}
						similarArtists={lastFmInfo?.similar || []}
						artistPicture={artistData?.artist?.picture ?? undefined}
					/>
				)}
			</div>
		</div>
	);
}
