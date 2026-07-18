import axios from "axios";
import { createHash } from "node:crypto";
import { config } from "../config.js";
import { prisma } from "../db/prisma.js";
import { logger } from "../logger.js";
import { incr } from "../metrics.js";

const log = logger.child({ scope: "lastfm" });
const BASE = "https://ws.audioscrobbler.com/2.0/";

// ── Response cache (persisted in Postgres, ToS §4.3.4) ───────────────────────
// Last.fm data changes slowly, so cache every response and serve it on repeat
// calls. TTL depends on how fast the underlying data moves. On a rate-limit
// (error 29) we fall back to a stale cached row rather than re-hitting the API.
const ONE_DAY = 86_400;
function ttlForMethod(method: string): number {
	const m = method.toLowerCase();
	if (m.startsWith("chart.")) return ONE_DAY; // trending — refresh daily
	if (m.endsWith("getsimilar") || m.startsWith("tag.gettop"))
		return 7 * ONE_DAY;
	if (m.endsWith("getinfo") || m.endsWith("gettoptags")) return 30 * ONE_DAY;
	return ONE_DAY;
}

function cacheKeyFor(method: string, params: Record<string, string>): string {
	const sorted = Object.keys(params)
		.sort()
		.map((k) => `${k}=${params[k]}`)
		.join("&");
	return createHash("sha1").update(`${method}?${sorted}`).digest("hex");
}

async function readCache(
	key: string,
	allowStale: boolean,
): Promise<{ response: string } | null> {
	try {
		const now = Math.floor(Date.now() / 1000);
		const row = await prisma.lastfmCache.findFirst({
			where: allowStale
				? { cacheKey: key }
				: { cacheKey: key, expiresAt: { gt: now } },
			select: { response: true },
		});
		return row ?? null;
	} catch {
		return null; // DB not ready (e.g. standalone script) — skip caching
	}
}

async function writeCache(
	key: string,
	method: string,
	response: string,
): Promise<void> {
	try {
		const now = Math.floor(Date.now() / 1000);
		const expiresAt = now + ttlForMethod(method);
		await prisma.lastfmCache.upsert({
			where: { cacheKey: key },
			create: { cacheKey: key, method, response, fetchedAt: now, expiresAt },
			update: { method, response, fetchedAt: now, expiresAt },
		});
	} catch {
		// Best-effort; a failed cache write must not break the request.
	}
}

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
			log.warn({ method }, "API key not configured, skipping");
			return null;
		}

		const key = cacheKeyFor(method, params);

		// 1) Fresh cache hit → return immediately, no network call.
		const fresh = await readCache(key, false);
		if (fresh) {
			try {
				incr("lastfm_cache_hit");
				return JSON.parse(fresh.response) as T;
			} catch {
				// Corrupt row — fall through and refetch.
			}
		}
		incr("lastfm_cache_miss");

		// 2) Fetch from Last.fm.
		try {
			const { data } = await axios.get<any>(BASE, {
				params: {
					method,
					api_key: config.lastfmApiKey,
					format: "json",
					...params,
				},
				timeout: 10_000,
			});

			// Last.fm signals failures in the body (e.g. error 29 = rate limit)
			// often with HTTP 200. Never cache an error body.
			if (data && typeof data === "object" && "error" in data) {
				incr(data.error === 29 ? "lastfm_rate_limited" : "lastfm_error_body");
				const stale = await readCache(key, true);
				if (stale) {
					incr("lastfm_stale_served");
					return JSON.parse(stale.response) as T;
				}
				return null;
			}

			incr("lastfm_fetch_ok");
			await writeCache(key, method, JSON.stringify(data));
			return data as T;
		} catch (err) {
			// Distinguish rate-limit / timeout / other for visibility, then serve
			// stale if we have it (the cache is our resilience, not a retry loop).
			if (axios.isAxiosError(err)) {
				if (err.response?.status === 429) incr("lastfm_rate_limited");
				else if (err.code === "ECONNABORTED") incr("lastfm_timeout");
				else incr("lastfm_network_error");
			} else {
				incr("lastfm_network_error");
			}
			const stale = await readCache(key, true);
			if (stale) {
				try {
					incr("lastfm_stale_served");
					return JSON.parse(stale.response) as T;
				} catch {
					return null;
				}
			}
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
			"overall" | "7day" | "1month" | "3month" | "6month" | "12month" = "7day",
		limit = 50,
	): Promise<LastFMTrack[]> {
		const data = await this.call<{
			tracks?: { track: LastFMTrack[] };
		}>("chart.getTopTracks", { period, limit: String(limit) });
		return data?.tracks?.track ?? [];
	}

	async getTopArtists(
		period:
			"overall" | "7day" | "1month" | "3month" | "6month" | "12month" = "7day",
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

	async getArtistTopTags(artist: string, limit = 5): Promise<string[]> {
		const data = await this.call<{
			toptags?: { tag: Array<{ name: string }> };
		}>("artist.getTopTags", { artist, autocorrect: "1" });
		return (data?.toptags?.tag ?? [])
			.map((t) => t.name)
			.filter(Boolean)
			.slice(0, limit);
	}

	async getArtistTopAlbums(artist: string, limit = 10): Promise<LastFMAlbum[]> {
		const data = await this.call<{
			topalbums?: {
				album: Array<{
					name: string;
					playcount?: string | number;
					url?: string;
					mbid?: string;
					artist: { name: string; mbid?: string };
				}>;
			};
		}>("artist.getTopAlbums", {
			artist,
			limit: String(limit),
			autocorrect: "1",
		});
		return (data?.topalbums?.album ?? []).map((a) => ({
			name: a.name,
			artist: { name: a.artist?.name ?? artist, mbid: a.artist?.mbid },
			mbid: a.mbid,
			playcount: a.playcount != null ? String(a.playcount) : undefined,
			url: a.url,
		}));
	}

	// ── Similar Tracks (content-based recommendation seed) ──────────────────────

	async getSimilarTracks(
		artist: string,
		track: string,
		limit = 50,
	): Promise<Array<LastFMTrack & { match?: number }>> {
		const data = await this.call<{
			similartracks?: {
				track: Array<{
					name: string;
					mbid?: string;
					match?: string | number;
					playcount?: string | number;
					url?: string;
					artist: { name: string; mbid?: string; url?: string };
				}>;
			};
		}>("track.getSimilar", {
			artist,
			track,
			limit: String(limit),
			autocorrect: "1",
		});
		return (data?.similartracks?.track ?? []).map((t) => ({
			name: t.name,
			artist: { name: t.artist.name, mbid: t.artist.mbid },
			mbid: t.mbid,
			playcount: t.playcount != null ? String(t.playcount) : undefined,
			url: t.url,
			match: t.match != null ? Number(t.match) : undefined,
		}));
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
