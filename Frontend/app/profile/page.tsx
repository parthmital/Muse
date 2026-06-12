"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { MediaShelf } from "@/components/MediaShelf";
import { MediaItem } from "@/components/MediaCard";
import { Song, SongRow } from "@/components/SongRow";
import { SongListHeader } from "@/components/SongListHeader";
import { FallbackImage } from "@/components/ui/FallbackImage";
import { IconButton } from "@/components/ui/IconButton";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { useAuth } from "@/context/AuthContext";
import { useLibraryManager } from "@/hooks/useLibraryManager";
import { useMediaActions } from "@/hooks/useMediaActions";
import { getTopArtists, getTopTracks, type TopTrack } from "@/lib/api";

const MOBILE_PROFILE_ROWS: { icon: string; label: string; href: string }[] = [
	{ icon: "History", label: "Listening history", href: "/liked" },
	{ icon: "Settings", label: "Settings and privacy", href: "/settings" },
];

function topTrackToSong(t: TopTrack): Song {
	return {
		title: t.title,
		artist: t.artist ?? "Unknown Artist",
		album: t.album ?? "",
		duration: "",
		img: t.coverUrl ?? "",
		liked: false,
		tidalId: Number(t.id),
		tidalArtistId: t.artistId ? Number(t.artistId) : undefined,
	};
}

export default function ProfilePage() {
	const { user, logout } = useAuth();
	const { customPlaylists } = useLibraryManager();
	const { share } = useMediaActions();

	const [sortBy, setSortBy] = useState<string>("default");
	const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

	const displayName = user?.displayName ?? "You";

	const { data: topTracksData } = useSWR(
		user ? ["top-tracks", user.id] : null,
		([, userId]) => getTopTracks(userId, 10),
	);
	const { data: topArtistsData } = useSWR(
		user ? ["top-artists", user.id] : null,
		([, userId]) => getTopArtists(userId, 10),
	);

	const topTracks: Song[] = (topTracksData?.tracks ?? []).map(topTrackToSong);
	const topArtists: MediaItem[] = (topArtistsData?.artists ?? []).map((a) => ({
		type: "artist",
		title: a.name,
		tidalId: a.id,
		imageUrl: a.pictureUrl ?? undefined,
	}));
	const playlistCount = customPlaylists.length;

	const handleSort = (key: string) => {
		if (sortBy === key) {
			setSortOrder(sortOrder === "asc" ? "desc" : "asc");
		} else {
			setSortBy(key);
			setSortOrder("asc");
		}
	};

	const sortedTracks = [...topTracks].sort((a, b) => {
		if (sortBy === "default") return 0;
		const valA = a[sortBy as keyof Song];
		const valB = b[sortBy as keyof Song];
		if (typeof valA === "string" && typeof valB === "string") {
			return sortOrder === "asc"
				? valA.localeCompare(valB)
				: valB.localeCompare(valA);
		}
		return 0;
	});

	const profileMenuItems = [
		{
			label: "Share Profile",
			icon: "Share",
			onClick: () => share(`${displayName} on Muse`),
		},
		{
			label: "Settings",
			icon: "Settings",
			onClick: () => {
				window.location.href = "/settings";
			},
		},
		{
			label: "Log out",
			icon: "Off",
			onClick: () => logout(),
			variant: "danger" as const,
		},
	];

	return (
		<>
			{/* ── Mobile layout ──────────────────────────────────────────────── */}
			<div className="flex flex-col gap-4 md:hidden">
				{/* Profile header card */}
				<div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-rose-950 to-neutral-900 p-4">
					<div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full">
						<FallbackImage
							src={null}
							fallbackType="Artist"
							alt={displayName}
							fill
							sizes="80px"
							className="object-cover"
							priority
						/>
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex items-start justify-between gap-2">
							<h1 className="truncate text-2xl font-bold text-white">
								{displayName}
							</h1>
							<div className="flex shrink-0 items-center">
								<IconButton
									icon="Share"
									alt="Share profile"
									onClick={() => share(`${displayName} on Muse`)}
								/>
							</div>
						</div>
						{user?.email && (
							<p className="mt-1 truncate text-sm text-neutral-400">
								{user.email}
							</p>
						)}
						<p className="truncate text-sm text-neutral-500">
							{playlistCount} {playlistCount === 1 ? "playlist" : "playlists"}
						</p>
					</div>
				</div>

				{/* Settings rows */}
				<div className="flex flex-col">
					{MOBILE_PROFILE_ROWS.map((row) => (
						<Link
							key={row.label}
							href={row.href}
							className="flex items-center gap-3 border-b border-neutral-800 py-3 last:border-b-0"
						>
							<IconButton icon={row.icon} alt={row.label} noHover />
							<span className="flex-1 text-base text-white">{row.label}</span>
							<IconButton icon="Right" alt="" noHover />
						</Link>
					))}
					<button
						onClick={() => logout()}
						className="flex items-center gap-3 border-b border-neutral-800 py-3 text-left last:border-b-0"
					>
						<IconButton icon="Off" alt="Log out" noHover />
						<span className="flex-1 text-base text-white">Log out</span>
					</button>
				</div>
			</div>

			{/* ── Desktop layout ─────────────────────────────────────────────── */}
			<div className="hidden w-full flex-col gap-6 md:flex">
				{/* Header */}
				<div className="flex items-center gap-6 py-2">
					<div className="relative h-48 w-48 shrink-0 overflow-hidden rounded-full border-4 border-neutral-800 shadow-2xl">
						<FallbackImage
							src={null}
							fallbackType="Artist"
							alt={displayName}
							fill
							sizes="192px"
							className="object-cover"
							priority
						/>
					</div>
					<div className="flex flex-col gap-4">
						<span className="text-sm font-bold tracking-widest text-neutral-500 uppercase">
							Profile
						</span>
						<h1 className="text-4xl font-black text-white">{displayName}</h1>
						{user?.email && (
							<span className="text-sm text-neutral-400">{user.email}</span>
						)}
						<div className="mt-2 flex items-center gap-6">
							<div className="flex flex-col">
								<span className="text-lg font-bold text-white">
									{playlistCount}
								</span>
								<span className="text-sm text-neutral-500">Playlists</span>
							</div>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<ActionMenu
						trigger={<IconButton icon="More" alt="More" />}
						items={profileMenuItems}
					/>
				</div>

				{/* Top Tracks */}
				<div className="flex flex-col gap-6">
					<div className="flex items-center justify-between">
						<h2 className="text-xl font-bold text-white">Your top tracks</h2>
					</div>
					{sortedTracks.length > 0 ? (
						<div className="flex flex-col gap-2">
							<SongListHeader
								hideAlbum
								sortBy={sortBy}
								sortOrder={sortOrder}
								onSort={handleSort}
							/>
							{sortedTracks.map((track, index) => (
								<SongRow
									key={`${track.title}-${index}`}
									song={track}
									index={index}
									hideAlbum
								/>
							))}
						</div>
					) : (
						<p className="text-sm text-neutral-500">
							Play some music and your most-played tracks will show up here.
						</p>
					)}
				</div>

				{/* Top Artists */}
				{topArtists.length > 0 && (
					<MediaShelf title="Your top artists" items={topArtists} />
				)}

				{/* Your Playlists */}
				{customPlaylists.length > 0 && (
					<MediaShelf title="Your playlists" items={customPlaylists} />
				)}
			</div>
		</>
	);
}
