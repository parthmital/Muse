/**
 * hooks/useTidalData.ts
 *
 * Generic data-fetching hooks for TIDAL resources:
 * albums, artists, playlists, mixes, and recommendations.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
	getAlbum,
	getArtist,
	getPlaylist,
	getMix,
	getRecommendations,
	getStreamInfo,
	type TidalTrack,
	type TidalAlbum,
	type TidalArtist,
	type StreamInfo,
} from "@/lib/api";

// ── Album ────────────────────────────────────────────────────────────────────

export function useTidalAlbum(albumId: number | null) {
	const [album, setAlbum] = useState<TidalAlbum | null>(null);
	const [tracks, setTracks] = useState<TidalTrack[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!albumId) return;
		setIsLoading(true);
		setError(null);

		getAlbum(albumId)
			.then((res) => {
				setAlbum(res.album);
				setTracks(res.tracks);
			})
			.catch((err) => setError(err.message))
			.finally(() => setIsLoading(false));
	}, [albumId]);

	return { album, tracks, isLoading, error };
}

// ── Artist ───────────────────────────────────────────────────────────────────

export function useTidalArtist(artistId: number | null) {
	const [artist, setArtist] = useState<TidalArtist | null>(null);
	const [cover, setCover] = useState<string | null>(null);
	const [albums, setAlbums] = useState<TidalAlbum[]>([]);
	const [topTracks, setTopTracks] = useState<TidalTrack[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!artistId) return;
		setIsLoading(true);
		setError(null);

		getArtist(artistId)
			.then((res) => {
				setArtist(res.artist);
				setCover(res.cover?.["750"] ?? null);
				setAlbums(res.albums);
				setTopTracks(res.topTracks);
			})
			.catch((err) => setError(err.message))
			.finally(() => setIsLoading(false));
	}, [artistId]);

	return { artist, cover, albums, topTracks, isLoading, error };
}

// ── Playlist ─────────────────────────────────────────────────────────────────

export function useTidalPlaylist(playlistId: string | null) {
	const [playlist, setPlaylist] = useState<any>(null);
	const [tracks, setTracks] = useState<TidalTrack[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!playlistId) return;
		setIsLoading(true);
		setError(null);

		getPlaylist(playlistId)
			.then((res) => {
				setPlaylist(res.playlist);
				setTracks(res.tracks);
			})
			.catch((err) => setError(err.message))
			.finally(() => setIsLoading(false));
	}, [playlistId]);

	return { playlist, tracks, isLoading, error };
}

// ── Mix ──────────────────────────────────────────────────────────────────────

export function useTidalMix(mixId: string | null) {
	const [mix, setMix] = useState<any>(null);
	const [tracks, setTracks] = useState<TidalTrack[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!mixId) return;
		setIsLoading(true);
		setError(null);

		getMix(mixId)
			.then((res) => {
				setMix(res.mix);
				setTracks(res.tracks);
			})
			.catch((err) => setError(err.message))
			.finally(() => setIsLoading(false));
	}, [mixId]);

	return { mix, tracks, isLoading, error };
}

// ── Recommendations ──────────────────────────────────────────────────────────

export function useTidalRecommendations(trackId: number | null) {
	const [items, setItems] = useState<TidalTrack[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(() => {
		if (!trackId) return;
		setIsLoading(true);
		setError(null);

		getRecommendations(trackId)
			.then((res) => setItems(res.items))
			.catch((err) => setError(err.message))
			.finally(() => setIsLoading(false));
	}, [trackId]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	return { items, isLoading, error, refresh };
}

// ── Stream URL ───────────────────────────────────────────────────────────────

export function useTidalStream(trackId: number | null, quality = "LOSSLESS") {
	const [stream, setStream] = useState<StreamInfo | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!trackId) {
			setStream(null);
			return;
		}
		setIsLoading(true);
		setError(null);

		getStreamInfo(trackId, quality)
			.then(setStream)
			.catch((err) => setError(err.message))
			.finally(() => setIsLoading(false));
	}, [trackId, quality]);

	return { stream, isLoading, error };
}
