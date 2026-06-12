"use client";

import { MediaShelf } from "@/components/MediaShelf";
import type { MediaItem, MediaType } from "@/components/MediaCard";
import { getPersonalizedHomeShelves } from "@/lib/api";
import { HomePageSkeleton } from "@/components/ui/Skeletons";
import { useAuth } from "@/context/AuthContext";
import useSWR from "swr";

export default function Home() {
	const { user } = useAuth();

	const { data, error, isLoading } = useSWR(
		user ? ["home-shelves", user.id] : null,
		([, userId]) => getPersonalizedHomeShelves(userId),
	);

	if (isLoading || !user) {
		return <HomePageSkeleton />;
	}

	if (error) {
		return (
			<div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6">
				<p className="font-medium text-red-300">
					Couldn&apos;t load your homepage right now.
				</p>
				<p className="mt-2 text-sm text-neutral-400">
					Check backend logs for `HomePage` and `apiFetch` entries.
				</p>
			</div>
		);
	}

	const shelves = (data?.shelves || [])
		.filter((s) => s.items.length > 0)
		.map((shelf) => ({
			title: shelf.title,
			subtitle: shelf.subtitle,
			items: shelf.items.map((item) => ({
				type: (item.type || "album") as MediaType,
				title: item.title,
				artist: item.artist,
				tidalId: item.tidalId,
				imageUrl: item.imageUrl ?? undefined,
				songs: item.songs,
				artistImages: item.artistImages,
			})) as MediaItem[],
		}));

	if (shelves.length === 0) {
		return (
			<div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-6">
				<p className="font-medium text-white">No homepage content yet.</p>
				<p className="mt-2 text-sm text-neutral-400">
					Play some music and your personalized shelves will appear here.
				</p>
			</div>
		);
	}

	return (
		<>
			{shelves.map((shelf) => (
				<MediaShelf
					key={shelf.title}
					title={shelf.title}
					subtitle={shelf.subtitle}
					items={shelf.items}
				/>
			))}
		</>
	);
}
