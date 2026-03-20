import axios from "axios";
import { config } from "../config.js";

const BASE = "https://ws.audioscrobbler.com/2.0/";

class LastFMClient {
	private async call<T>(
		method: string,
		params: Record<string, string>,
	): Promise<T | null> {
		if (!config.lastfmApiKey) return null;
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

	async enrich(artist: string, track: string) {
		const [tags, info] = await Promise.all([
			this.getTrackTags(artist, track),
			this.getTrackInfo(artist, track),
		]);
		return { tags, playCount: info?.playCount ?? null };
	}
}

export const lastfmClient = new LastFMClient();
