"use client";

import { useState, useEffect } from "react";
import { MediaShelf } from "@/components/MediaShelf";
import { MediaItem } from "@/components/MediaCard";
import { searchTracks, searchAlbums, searchArtists } from "@/lib/api";
import {
	tidalAlbumToMediaItem,
	tidalArtistToMediaItem,
	tidalTrackToMediaItem,
} from "@/lib/tidalAdapter";

// ── Home Page ────────────────────────────────────────────────────────────────

export default function Home() {
	const [trendingTracks, setTrendingTracks] = useState<MediaItem[]>([]);
	const [newAlbums, setNewAlbums] = useState<MediaItem[]>([]);
	const [popularArtists, setPopularArtists] = useState<MediaItem[]>([]);
	const [isLoaded, setIsLoaded] = useState(false);

	useEffect(() => {
		let cancelled = false;

		async function fetchTidalData() {
			try {
				const [trackRes, albumRes, artistRes] = await Promise.allSettled([
					searchTracks("trending", 8),
					searchAlbums("new releases", 8),
					searchArtists("popular", 6),
				]);

				if (cancelled) return;

				if (
					trackRes.status === "fulfilled" &&
					trackRes.value.items.length > 0
				) {
					// Deduplicate albums from trending tracks
					const seen = new Set<number>();
					const items: MediaItem[] = [];
					for (const track of trackRes.value.items) {
						const albumId = track.album?.id;
						if (albumId && !seen.has(albumId)) {
							seen.add(albumId);
							items.push(tidalTrackToMediaItem(track));
						}
					}
					setTrendingTracks(items);
				}

				if (
					albumRes.status === "fulfilled" &&
					albumRes.value.items.length > 0
				) {
					setNewAlbums(albumRes.value.items.map(tidalAlbumToMediaItem));
				}

				if (
					artistRes.status === "fulfilled" &&
					artistRes.value.items.length > 0
				) {
					setPopularArtists(artistRes.value.items.map(tidalArtistToMediaItem));
				}
			} catch {
				// Silently fall back to static data
			} finally {
				if (!cancelled) setIsLoaded(true);
			}
		}

		fetchTidalData();
		return () => {
			cancelled = true;
		};
	}, []);

	if (!isLoaded) {
		return (
			<div className="p-8 text-neutral-400">Loading recommendations...</div>
		);
	}

	return (
		<>
			{trendingTracks.length > 0 && (
				<MediaShelf title="Trending Tracks" items={trendingTracks} />
			)}
			{popularArtists.length > 0 && (
				<MediaShelf title="Popular Artists" items={popularArtists} />
			)}
			{newAlbums.length > 0 && (
				<MediaShelf title="New Albums" items={newAlbums} />
			)}
		</>
	);
}
