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

export interface LastFMTagInfo {
	name: string;
	url: string;
	reach: string;
	taggings: string;
	streamable: string;
	wiki: {
		published: string;
		summary: string;
		content: string;
	};
}

export interface LastFMSimilarTag {
	name: string;
	url: string;
	streamable: string;
}

export interface LastFMArtistInfo {
	name: string;
	mbid?: string;
	listeners: string;
	playcount: string;
	bio: {
		summary: string;
		content: string;
	};
	similar: Array<{
		name: string;
		url: string;
		image?: string;
	}>;
	tags: string[];
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

	async getTagInfo(tag: string): Promise<LastFMTagInfo | null> {
		const data = await this.call<{
			tag?: {
				name: string;
				url: string;
				reach: string;
				taggings: string;
				streamable: string;
				wiki?: {
					published?: string;
					summary?: string;
					content?: string;
				};
			};
		}>("tag.getInfo", { tag });
		if (!data?.tag) return null;
		return {
			name: data.tag.name,
			url: data.tag.url,
			reach: data.tag.reach,
			taggings: data.tag.taggings,
			streamable: data.tag.streamable,
			wiki: {
				published: data.tag.wiki?.published ?? "",
				summary: data.tag.wiki?.summary ?? "",
				content: data.tag.wiki?.content ?? "",
			},
		};
	}

	async getSimilarTags(tag: string, limit = 20): Promise<LastFMSimilarTag[]> {
		const data = await this.call<{
			similartags?: {
				tag: Array<{ name: string; url: string; streamable: string }>;
			};
		}>("tag.getSimilar", { tag, limit: String(limit) });
		return (data?.similartags?.tag ?? []).map((t) => ({
			name: t.name,
			url: t.url,
			streamable: t.streamable,
		}));
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

	async getArtistInfo(
		artist: string,
		limit = 10,
	): Promise<LastFMArtistInfo | null> {
		// Fetch both artist.getInfo and artist.getSimilar in parallel
		const [infoData, similarData] = await Promise.all([
			this.call<{
				artist?: {
					name: string;
					mbid?: string;
					stats?: { listeners?: string; playcount?: string };
					bio?: { summary?: string; content?: string };
					similar?: { artist?: Array<{ name: string; url: string }> };
					tags?: { tag?: Array<{ name: string }> };
				};
			}>("artist.getInfo", { artist, autocorrect: "1" }),
			this.call<{
				similarartists?: {
					artist?: Array<{
						name: string;
						url: string;
						image?: Array<{ "#text": string; size: string }>;
					}>;
				};
			}>("artist.getSimilar", { artist, limit: String(limit) }),
		]);

		const artistInfo = infoData?.artist;
		if (!artistInfo) return null;

		// Extract similar artists from getSimilar call for better images
		const similarArtists =
			similarData?.similarartists?.artist?.map((a) => ({
				name: a.name,
				url: a.url,
				image: a.image?.find((img) => img.size === "large")?.["#text"],
			})) ?? [];

		return {
			name: artistInfo.name,
			mbid: artistInfo.mbid,
			listeners: artistInfo.stats?.listeners ?? "0",
			playcount: artistInfo.stats?.playcount ?? "0",
			bio: {
				summary: artistInfo.bio?.summary ?? "",
				content: artistInfo.bio?.content ?? "",
			},
			similar: similarArtists,
			tags: (artistInfo.tags?.tag ?? []).map((t) => t.name),
		};
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
