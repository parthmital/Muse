/**
 * hooks/useTidalSearch.ts
 *
 * Debounced search hook that queries the Muse backend
 * for TIDAL search results across tracks, artists, albums, and playlists.
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
	searchTracks,
	searchArtists,
	searchAlbums,
	searchPlaylists,
	searchAll,
	type TidalTrack,
	type TidalArtist,
	type TidalAlbum,
} from "@/lib/api";

export interface TidalSearchResults {
	tracks: TidalTrack[];
	artists: TidalArtist[];
	albums: TidalAlbum[];
	playlists: any[];
	isLoading: boolean;
	error: string | null;
}

export function useTidalSearch(
	query: string,
	debounceMs = 350,
): TidalSearchResults {
	const [tracks, setTracks] = useState<TidalTrack[]>([]);
	const [artists, setArtists] = useState<TidalArtist[]>([]);
	const [albums, setAlbums] = useState<TidalAlbum[]>([]);
	const [playlists, setPlaylists] = useState<any[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	useEffect(() => {
		// Clear results if query is empty
		if (!query.trim()) {
			setTracks([]);
			setArtists([]);
			setAlbums([]);
			setPlaylists([]);
			setIsLoading(false);
			setError(null);
			return;
		}

		setIsLoading(true);
		setError(null);

		const timeout = setTimeout(async () => {
			// Cancel previous in-flight requests
			abortRef.current?.abort();
			const controller = new AbortController();
			abortRef.current = controller;

			try {
				const results = await searchAll(query, 10, controller.signal);

				if (controller.signal.aborted) return;

				setTracks(results.tracks);
				setArtists(results.artists);
				setAlbums(results.albums);
				setPlaylists(results.playlists);
				setError(null);
			} catch (err: any) {
				if (err.name === "AbortError") return;
				setError(err.message ?? "Search failed");
			} finally {
				if (!controller.signal.aborted) setIsLoading(false);
			}
		}, debounceMs);

		return () => {
			clearTimeout(timeout);
			abortRef.current?.abort();
		};
	}, [query, debounceMs]);

	return { tracks, artists, albums, playlists, isLoading, error };
}
