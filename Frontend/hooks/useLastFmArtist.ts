"use client";

import useSWR from "swr";
import { getLastFmArtistInfo, type LastFmArtistInfo } from "@/lib/api";

interface UseLastFmArtistResult {
	info: LastFmArtistInfo | null;
	isLoading: boolean;
	error: string | null;
}

/**
 * Hook to fetch Last.fm artist information including:
 * - listener count
 * - biography (summary and full content)
 * - similar artists
 * - tags/genres
 */
export function useLastFmArtist(
	artistName: string | null,
): UseLastFmArtistResult {
	const { data, error, isLoading } = useSWR(
		artistName ? ["lastfm-artist", artistName] : null,
		([, name]) => getLastFmArtistInfo(name),
		{ revalidateOnFocus: false },
	);

	return {
		info: data ?? null,
		isLoading,
		error: error?.message ?? null,
	};
}
