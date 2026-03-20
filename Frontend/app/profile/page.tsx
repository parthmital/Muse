"use client";

import { useState } from "react";
import { MediaShelf } from "@/components/MediaShelf";
import { MediaItem } from "@/components/MediaCard";
import { Song, SongRow } from "@/components/SongRow";
import { SongListHeader } from "@/components/SongListHeader";
import { FallbackImage } from "@/components/ui/FallbackImage";
import { IconButton } from "@/components/ui/IconButton";
import { ActionMenu } from "@/components/ui/ActionMenu";

const TOP_ARTISTS: MediaItem[] = [
	{ title: "Linkin Park", type: "artist" },
	{ title: "Daft Punk", type: "artist" },
	{ title: "Eminem", type: "artist" },
	{ title: "Muse", type: "artist" },
	{ title: "System Of A Down", type: "artist" },
	{ title: "David Bowie", type: "artist" },
	{ title: "The Weeknd", type: "artist" },
	{ title: "Gorillaz", type: "artist" },
	{ title: "Radiohead", type: "artist" },
	{ title: "Pink Floyd", type: "artist" },
];

const TOP_TRACKS: Song[] = [
	{
		title: "Numb",
		artist: "Linkin Park",
		album: "Meteora",
		duration: "3:05",
		img: "/images/Meteora.png",
		liked: true,
	},
	{
		title: "Get Lucky",
		artist: "Daft Punk",
		album: "Random Access Memories",
		duration: "6:09",
		img: "/images/Daily Mix 2.png",
		liked: false,
	},
	{
		title: "Starlight",
		artist: "Muse",
		album: "Black Holes and Revelations",
		duration: "4:00",
		img: "/images/Black Holes and Revelations.png",
		liked: true,
	},
	{
		title: "Starman",
		artist: "David Bowie",
		album: "The Rise and Fall of Ziggy Stardust",
		duration: "4:10",
		img: "/images/Search/Pop.png",
		liked: false,
	},
	{
		title: "Lose Yourself",
		artist: "Eminem",
		album: "8 Mile",
		duration: "5:26",
		img: "/images/Daily Mix 3.png",
		liked: true,
	},
	{
		title: "In the End",
		artist: "Linkin Park",
		album: "Hybrid Theory",
		duration: "3:36",
		img: "/images/Hybrid Theory.png",
		liked: false,
	},
	{
		title: "Instant Crush",
		artist: "Daft Punk",
		album: "Random Access Memories",
		duration: "5:37",
		img: "/images/Random Access Memories.png",
		liked: true,
	},
	{
		title: "Supermassive Black Hole",
		artist: "Muse",
		album: "Black Holes and Revelations",
		duration: "3:29",
		img: "/images/Black Holes and Revelations.png",
		liked: false,
	},
	{
		title: "Chop Suey!",
		artist: "System Of A Down",
		album: "Toxicity",
		duration: "3:30",
		img: "/images/Daily Mix 1.png",
		liked: true,
	},
	{
		title: "Feel Good Inc.",
		artist: "Gorillaz",
		album: "Demon Days",
		duration: "3:41",
		img: "/images/Daily Mix 2.png",
		liked: false,
	},
];

const PUBLIC_PLAYLISTS: MediaItem[] = [
	{
		title: "Chill Stuff",
		songs: 85,
		type: "mix",
		desc: "Relaxing tunes for your downtime.",
	},
	{
		title: "Workout Energy",
		songs: 42,
		type: "mix",
		desc: "High BPM tracks to keep you going.",
	},
	{
		title: "Rock Hits",
		songs: 120,
		type: "mix",
		desc: "The best rock tracks from all decades.",
	},
	{
		title: "Study Beats",
		songs: 65,
		type: "mix",
		desc: "Focus with peaceful lo-fi.",
	},
	{
		title: "90s Nostalgia",
		songs: 92,
		type: "mix",
		desc: "The defining sounds of the nineties.",
	},
	{
		title: "Late Night Drive",
		songs: 48,
		type: "mix",
		desc: "Driving through the neon city.",
	},
	{
		title: "Morning Vibes",
		songs: 35,
		type: "mix",
		desc: "Start your day with positive energy.",
	},
	{
		title: "Jazz Classics",
		songs: 74,
		type: "mix",
		desc: "The greats of the jazz era.",
	},
	{
		title: "Gaming Focus",
		songs: 55,
		type: "mix",
		desc: "Keep your head in the game.",
	},
	{
		title: "Indie Gems",
		songs: 82,
		type: "mix",
		desc: "Discover some hidden underground talent.",
	},
];

export default function ProfilePage() {
	const [userName] = useState("Parth Mital");
	const [sortBy, setSortBy] = useState<string>("default");
	const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

	const handleSort = (key: string) => {
		if (sortBy === key) {
			setSortOrder(sortOrder === "asc" ? "desc" : "asc");
		} else {
			setSortBy(key);
			setSortOrder("asc");
		}
	};

	const sortedTracks = [...TOP_TRACKS].sort((a, b) => {
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

	return (
		<div className="flex w-full flex-col gap-6">
			{/* Header */}
			<div className="flex items-center gap-6 py-2">
				<div className="relative h-48 w-48 shrink-0 overflow-hidden rounded-full border-4 border-neutral-800 shadow-2xl">
					<FallbackImage
						src={null}
						fallbackType="Artist"
						alt={userName}
						fill
						className="object-cover"
						priority
					/>
				</div>
				<div className="flex flex-col gap-4">
					<span className="text-sm font-bold tracking-widest text-neutral-500 uppercase">
						Profile
					</span>
					<h1 className="text-4xl font-black text-white">{userName}</h1>
					<div className="mt-2 flex items-center gap-6">
						<div className="flex flex-col">
							<span className="text-lg font-bold text-white">12</span>
							<span className="text-sm text-neutral-500">Public Playlists</span>
						</div>
						<div className="flex flex-col">
							<span className="text-lg font-bold text-white">248</span>
							<span className="text-sm text-neutral-500">Followers</span>
						</div>
						<div className="flex flex-col">
							<span className="text-lg font-bold text-white">182</span>
							<span className="text-sm text-neutral-500">Following</span>
						</div>
					</div>
				</div>
			</div>

			<div className="flex items-center gap-3">
				<button className="rounded-full border border-neutral-700 px-6 py-2 font-bold text-white transition-colors hover:bg-neutral-800">
					Edit Profile
				</button>
				<ActionMenu
					trigger={<IconButton icon="More" alt="More" />}
					items={[
						{
							label: "Copy Link",
							icon: "Link",
							onClick: () => console.log("Copy Link"),
						},
						{
							label: "Share Profile",
							icon: "Share",
							onClick: () => console.log("Share Profile"),
						},
						{
							label: "Account Settings",
							icon: "Settings",
							onClick: () => console.log("Account Settings"),
						},
					]}
				/>
			</div>

			{/* Top Tracks */}
			<div className="flex flex-col gap-6">
				<div className="flex items-center justify-between">
					<h2 className="text-xl font-bold text-white">
						Top tracks this month
					</h2>
				</div>
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
			</div>

			{/* Top Artists */}
			<MediaShelf title="Top artists this month" items={TOP_ARTISTS} />

			{/* Public Playlists */}
			<MediaShelf title="Public Playlists" items={PUBLIC_PLAYLISTS} />
		</div>
	);
}
