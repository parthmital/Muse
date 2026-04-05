"use client";

import { useState, useEffect } from "react";
import { MediaShelf } from "@/components/MediaShelf";
import type { MediaItem, MediaType } from "@/components/MediaCard";
import { getPersonalizedHomeShelves } from "@/lib/api";
import { HomePageSkeleton } from "@/components/ui/Skeletons";
import { logger } from "@/lib/logger";

const DEV_USER_ID = "dev-user-001";

export default function Home() {
	const [shelves, setShelves] = useState<
		Array<{
			title: string;
			items: MediaItem[];
		}>
	>([]);
	const [isLoaded, setIsLoaded] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function fetchHomeData() {
			try {
				const data = await getPersonalizedHomeShelves(DEV_USER_ID);

				if (cancelled) return;

				const mappedShelves = (data.shelves || [])
					.filter((s) => s.items.length > 0)
					.map((shelf) => ({
						title: shelf.title,
						items: shelf.items.map((item) => ({
							type: (item.type || "album") as MediaType,
							title: item.title,
							artist: item.artist,
							tidalId: item.tidalId,
							imageUrl: item.imageUrl ?? undefined,
							songs: item.songs,
						})),
					}));

				setShelves(mappedShelves);
				if (mappedShelves.length === 0) {
					logger.warn(
						"HomePage",
						"Homepage loaded but returned no displayable shelves",
						{ userId: DEV_USER_ID },
					);
				}
			} catch (error) {
				logger.error("HomePage", "Failed to load homepage shelves", error, {
					userId: DEV_USER_ID,
				});
				setErrorMessage("Couldn't load your homepage right now.");
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

	if (errorMessage) {
		return (
			<div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6">
				<p className="font-medium text-red-300">{errorMessage}</p>
				<p className="mt-2 text-sm text-neutral-400">
					Check backend logs for `HomePage` and `apiFetch` entries.
				</p>
			</div>
		);
	}

	if (shelves.length === 0) {
		return (
			<div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-6">
				<p className="font-medium text-white">No homepage content yet.</p>
				<p className="mt-2 text-sm text-neutral-400">
					We couldn&apos;t find any shelves to show right now.
				</p>
			</div>
		);
	}

	return (
		<>
			{shelves.map((shelf) => (
				<MediaShelf key={shelf.title} title={shelf.title} items={shelf.items} />
			))}
		</>
	);
}
