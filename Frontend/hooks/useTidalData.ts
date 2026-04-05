/**
 * hooks/useTidalData.ts
 *
 * Generic data-fetching hooks for TIDAL resources:
 * albums, artists, playlists, mixes, and recommendations.
 */

"use client";

import { useCallback } from "react";
import useSWR from "swr";
import {
	getAlbum,
	getArtist,
	getPlaylist,
	getMix,
	getRecommendations,
	getStreamInfo,
	type StreamInfo,
} from "@/lib/api";

// ── Album ────────────────────────────────────────────────────────────────────

export function useTidalAlbum(albumId: number | null) {
	const { data, error, isLoading } = useSWR(
		albumId ? ["tidal-album", albumId] : null,
		([, id]) => getAlbum(id),
		{ revalidateOnFocus: false },
	);

	return {
		album: data?.album ?? null,
		tracks: data?.tracks ?? [],
		isLoading,
		error: error?.message ?? null,
	};
}

// ── Artist ───────────────────────────────────────────────────────────────────

export function useTidalArtist(artistId: number | null) {
	const { data, error, isLoading } = useSWR(
		artistId ? ["tidal-artist", artistId] : null,
		([, id]) => getArtist(id),
		{ revalidateOnFocus: false },
	);

	return {
		artist: data?.artist ?? null,
		cover: data?.cover?.["750"] ?? null,
		albums: data?.albums ?? [],
		topTracks: data?.topTracks ?? [],
		isLoading,
		error: error?.message ?? null,
	};
}

// ── Playlist ─────────────────────────────────────────────────────────────────

export function useTidalPlaylist(playlistId: string | null) {
	const { data, error, isLoading } = useSWR(
		playlistId ? ["tidal-playlist", playlistId] : null,
		([, id]) => getPlaylist(id),
		{ revalidateOnFocus: false },
	);

	return {
		playlist: data?.playlist ?? null,
		tracks: data?.tracks ?? [],
		isLoading,
		error: error?.message ?? null,
	};
}

// ── Mix ──────────────────────────────────────────────────────────────────────

export function useTidalMix(mixId: string | null) {
	const { data, error, isLoading } = useSWR(
		mixId ? ["tidal-mix", mixId] : null,
		([, id]) => getMix(id),
		{ revalidateOnFocus: false },
	);

	return {
		mix: data?.mix ?? null,
		tracks: data?.tracks ?? [],
		isLoading,
		error: error?.message ?? null,
	};
}

// ── Recommendations ──────────────────────────────────────────────────────────

export function useTidalRecommendations(trackId: number | null) {
	const { data, error, isLoading, mutate } = useSWR(
		trackId ? ["tidal-recommendations", trackId] : null,
		([, id]) => getRecommendations(id),
		{ revalidateOnFocus: false },
	);

	const refresh = useCallback(() => {
		void mutate();
	}, [mutate]);

	return {
		items: data?.items ?? [],
		isLoading,
		error: error?.message ?? null,
		refresh,
	};
}

// ── Stream URL ───────────────────────────────────────────────────────────────

export function useTidalStream(trackId: number | null, quality?: string) {
	const { data, error, isLoading } = useSWR(
		trackId ? ["tidal-stream", trackId, quality ?? "auto"] : null,
		([, id, q]) => getStreamInfo(id, q === "auto" ? undefined : q),
		{ revalidateOnFocus: false },
	);

	return {
		stream: (data as StreamInfo | undefined) ?? null,
		isLoading,
		error: error?.message ?? null,
	};
}
