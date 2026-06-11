import { Suspense } from "react";
import { MediaShelf } from "@/components/MediaShelf";
import type { MediaItem, MediaType } from "@/components/MediaCard";
import { getPersonalizedHomeShelves } from "@/lib/api";
import { HomePageSkeleton } from "@/components/ui/Skeletons";
import { logger } from "@/lib/logger";

const DEV_USER_ID = "dev-user-001";
export const dynamic = "force-dynamic";

export default function Home() {
	// Flush the page shell + skeleton immediately, then stream shelves in as the
	// backend resolves them — no blank screen while recommendations are built.
	return (
		<Suspense fallback={<HomePageSkeleton />}>
			<HomeShelves />
		</Suspense>
	);
}

async function HomeShelves() {
	let shelves: Array<{
		title: string;
		subtitle?: string;
		items: MediaItem[];
	}> = [];
	let errorMessage: string | null = null;

	try {
		const data = await getPersonalizedHomeShelves(DEV_USER_ID);
		shelves = (data.shelves || [])
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
				})),
			}));

		if (shelves.length === 0) {
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
		errorMessage = "Couldn't load your homepage right now.";
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
