import axios from "axios";
import { config } from "../config.js";

const BASE = "https://ws.audioscrobbler.com/2.0/";

// ── Types ────────────────────────────────────────────────────────────────────

export interface LastFMTrack {
	name: string;
	artist: { name: string; mbid?: string };
	mbid?: string;
	playcount?: string;
	listeners?: string;
	url?: string;
}

export interface LastFMArtist {
	name: string;
	mbid?: string;
	playcount?: string;
	listeners?: string;
	url?: string;
}

export interface LastFMAlbum {
	name: string;
	artist: { name: string; mbid?: string };
	mbid?: string;
	playcount?: string;
	url?: string;
}

export interface LastFMTag {
	name: string;
	count?: number;
	url?: string;
}

// ── Client ─────────────────────────────────────────────────────────────────────

class LastFMClient {
	private async call<T>(
		method: string,
		params: Record<string, string>,
	): Promise<T | null> {
		if (!config.lastfmApiKey) {
			console.warn(`[LastFM] API key not configured, skipping ${method}`);
			return null;
		}
		try {
			const { data } = await axios.get<T>(BASE, {
				params: {
					method,
					api_key: config.lastfmApiKey,
					format: "json",
					...params,
				},
				timeout: 10_000,
			});
			return data;
		} catch {
			return null;
		}
	}

	// ── Track Info ─────────────────────────────────────────────────────────────

	async getTrackTags(artist: string, track: string): Promise<string[]> {
		const data = await this.call<{
			toptags?: { tag: Array<{ name: string }> };
		}>("track.getTopTags", { artist, track });
		return (data?.toptags?.tag ?? [])
			.map((t) => t.name.toLowerCase())
			.slice(0, 10);
	}

	async getTrackInfo(
		artist: string,
		track: string,
	): Promise<{ playCount?: number } | null> {
		const data = await this.call<{
			track?: { playcount?: string };
		}>("track.getInfo", { artist, track });
		const pc = data?.track?.playcount;
		return pc ? { playCount: parseInt(pc, 10) } : null;
	}

	// ── Chart Methods (Real Popularity Data) ───────────────────────────────────

	async getTopTracks(
		period:
			| "overall"
			| "7day"
			| "1month"
			| "3month"
			| "6month"
			| "12month" = "7day",
		limit = 50,
	): Promise<LastFMTrack[]> {
		const data = await this.call<{
			tracks?: { track: LastFMTrack[] };
		}>("chart.getTopTracks", { period, limit: String(limit) });
		return data?.tracks?.track ?? [];
	}

	async getTopArtists(
		period:
			| "overall"
			| "7day"
			| "1month"
			| "3month"
			| "6month"
			| "12month" = "7day",
		limit = 50,
	): Promise<LastFMArtist[]> {
		const data = await this.call<{
			artists?: { artist: LastFMArtist[] };
		}>("chart.getTopArtists", { period, limit: String(limit) });
		return data?.artists?.artist ?? [];
	}

	async getTopTags(limit = 50): Promise<LastFMTag[]> {
		const data = await this.call<{
			tags?: { tag: LastFMTag[] };
		}>("chart.getTopTags", { limit: String(limit) });
		return data?.tags?.tag ?? [];
	}

	// ── Tag Methods ────────────────────────────────────────────────────────────

	async getTopTracksByTag(tag: string, limit = 50): Promise<LastFMTrack[]> {
		const data = await this.call<{
			tracks?: { track: LastFMTrack[] };
		}>("tag.getTopTracks", { tag, limit: String(limit) });
		return data?.tracks?.track ?? [];
	}

	async getTopArtistsByTag(tag: string, limit = 50): Promise<LastFMArtist[]> {
		const data = await this.call<{
			topartists?: { artist: LastFMArtist[] };
		}>("tag.getTopArtists", { tag, limit: String(limit) });
		return data?.topartists?.artist ?? [];
	}

	async getTopAlbumsByTag(tag: string, limit = 50): Promise<LastFMAlbum[]> {
		const data = await this.call<{
			albums?: { album: LastFMAlbum[] };
		}>("tag.getTopAlbums", { tag, limit: String(limit) });
		return data?.albums?.album ?? [];
	}

	// ── Artist Methods ─────────────────────────────────────────────────────────

	async getArtistTopTracks(artist: string, limit = 20): Promise<LastFMTrack[]> {
		const data = await this.call<{
			toptracks?: { track: LastFMTrack[] };
		}>("artist.getTopTracks", { artist, limit: String(limit) });
		return data?.toptracks?.track ?? [];
	}

	async getSimilarArtists(artist: string, limit = 20): Promise<LastFMArtist[]> {
		const data = await this.call<{
			similarartists?: { artist: LastFMArtist[] };
		}>("artist.getSimilar", { artist, limit: String(limit) });
		return data?.similarartists?.artist ?? [];
	}

	// ── Enrich ─────────────────────────────────────────────────────────────────

	async enrich(artist: string, track: string) {
		const [tags, info] = await Promise.all([
			this.getTrackTags(artist, track),
			this.getTrackInfo(artist, track),
		]);
		return { tags, playCount: info?.playCount ?? null };
	}
}

export const lastfmClient = new LastFMClient();
