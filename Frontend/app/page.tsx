"use client";

import { useState, useEffect } from "react";
import { MediaShelf } from "@/components/MediaShelf";
import type { MediaItem } from "@/components/MediaCard";
import { getHomeShelves } from "@/lib/api";
import { HomePageSkeleton } from "@/components/ui/Skeletons";

export default function Home() {
	const [shelves, setShelves] = useState<
		Array<{
			title: string;
			items: MediaItem[];
		}>
	>([]);
	const [isLoaded, setIsLoaded] = useState(false);

	useEffect(() => {
		let cancelled = false;

		async function fetchHomeData() {
			try {
				const data = await getHomeShelves();

				if (cancelled) return;

				const mappedShelves = (data.shelves || [])
					.filter((s) => s.items.length > 0)
					.map((shelf) => ({
						title: shelf.title,
						items: shelf.items.map((item) => ({
							type: (item.type || "album") as any,
							title: item.title,
							artist: item.artist,
							tidalId: item.tidalId,
							imageUrl: item.imageUrl ?? undefined,
							songs: item.songs,
						})),
					}));

				setShelves(mappedShelves);
			} catch {
				// Silently fail
			} finally {
				if (!cancelled) setIsLoaded(true);
			}
		}

		fetchHomeData();
		return () => {
			cancelled = true;
		};
	}, []);

	if (!isLoaded) {
		return <HomePageSkeleton />;
	}

	return (
		<>
			{shelves.map((shelf, i) => (
				<MediaShelf key={shelf.title} title={shelf.title} items={shelf.items} />
			))}
		</>
	);
}
