import axios, { AxiosInstance } from "axios";
import { config } from "../config.js";

export interface HifiTrack {
	id: string;
	title: string;
	duration?: number;
	bpm?: number;
	key?: string;
	keyScale?: string;
	popularity?: number;
	explicit?: boolean;
	audioQuality?: string;
	isrc?: string;
	mixes?: Record<string, string>;
	replayGain?: number;
	artist?: HifiArtist;
	album?: HifiAlbum;
}

export interface HifiArtist {
	id: string;
	name: string;
	popularity?: number;
	picture?: string;
}

export interface HifiAlbum {
	id: string;
	title: string;
	cover?: string;
	vibrantColor?: string;
	releaseDate?: string;
}

class HifiClient {
	private http: AxiosInstance;

	constructor() {
		this.http = axios.create({
			baseURL: config.hifiBaseUrl,
			headers: { Authorization: `Bearer ${config.hifiApiKey}` },
			timeout: 30_000,
		});
		this.http.interceptors.response.use(undefined, async (err) => {
			const cfg = err.config;
			cfg._retries = (cfg._retries ?? 0) + 1;
			if (cfg._retries <= 3 && err.response?.status >= 500) {
				await delay(cfg._retries * 1000);
				return this.http.request(cfg);
			}
			throw err;
		});
	}

	async getTrack(id: string): Promise<HifiTrack> {
		const { data } = await this.http.get<HifiTrack>(`/tracks/${id}`);
		return data;
	}

	async getTracks(ids: string[]): Promise<HifiTrack[]> {
		const results: HifiTrack[] = [];
		for (const chunk of chunks(ids, 50)) {
			const { data } = await this.http.get<{ items: HifiTrack[] }>("/tracks", {
				params: { ids: chunk.join(",") },
			});
			results.push(...(data.items ?? []));
		}
		return results;
	}

	async *streamCatalogue(pageSize = 100): AsyncGenerator<HifiTrack> {
		let offset = 0;
		while (true) {
			const { data } = await this.http.get<{ items: HifiTrack[] }>("/tracks", {
				params: { limit: pageSize, offset },
			});
			const items = data.items ?? [];
			for (const item of items) yield item;
			if (items.length < pageSize) break;
			offset += pageSize;
		}
	}
}

function chunks<T>(arr: T[], n: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
	return out;
}

function delay(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

export const hifiClient = new HifiClient();
