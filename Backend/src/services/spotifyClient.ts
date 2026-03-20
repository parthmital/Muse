/**
 * Spotify Web API client – Client Credentials flow.
 * Fetches audio features (energy, valence, danceability, etc.)
 * No audio download. Matches tracks via ISRC or title+artist search.
 */

import axios, { AxiosInstance } from "axios";
import { config } from "../config.js";

export interface SpotifyAudioFeatures {
	id: string;
	energy: number;
	valence: number;
	danceability: number;
	acousticness: number;
	instrumentalness: number;
	loudness: number;
	speechiness: number;
	liveness: number;
	tempo: number;
}

class SpotifyClient {
	private http: AxiosInstance;
	private token: string | null = null;
	private tokenExpiresAt = 0;

	constructor() {
		this.http = axios.create({
			baseURL: "https://api.spotify.com/v1",
			timeout: 15_000,
		});
	}

	private async getToken(): Promise<string> {
		if (this.token && Date.now() < this.tokenExpiresAt - 30_000) {
			return this.token;
		}
		if (!config.spotifyClientId || !config.spotifyClientSecret) return "";
		const creds = Buffer.from(
			`${config.spotifyClientId}:${config.spotifyClientSecret}`,
		).toString("base64");
		const { data } = await axios.post<{
			access_token: string;
			expires_in: number;
		}>(
			"https://accounts.spotify.com/api/token",
			"grant_type=client_credentials",
			{
				headers: {
					Authorization: `Basic ${creds}`,
					"Content-Type": "application/x-www-form-urlencoded",
				},
			},
		);
		this.token = data.access_token;
		this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
		return this.token;
	}

	private async get<T>(
		path: string,
		params?: Record<string, string>,
	): Promise<T> {
		const token = await this.getToken();
		const { data } = await this.http.get<T>(path, {
			headers: { Authorization: `Bearer ${token}` },
			params,
		});
		return data;
	}

	async resolveId(
		title: string,
		artist: string,
		isrc?: string | null,
	): Promise<string | null> {
		try {
			if (isrc) {
				const r = await this.get<{ tracks: { items: Array<{ id: string }> } }>(
					"/search",
					{ q: `isrc:${isrc}`, type: "track", limit: "1" },
				);
				if (r.tracks.items[0]) return r.tracks.items[0].id;
			}
			const r = await this.get<{ tracks: { items: Array<{ id: string }> } }>(
				"/search",
				{ q: `track:${title} artist:${artist}`, type: "track", limit: "1" },
			);
			return r.tracks.items[0]?.id ?? null;
		} catch {
			return null;
		}
	}

	async getAudioFeatures(
		spotifyId: string,
	): Promise<SpotifyAudioFeatures | null> {
		try {
			const data = await this.get<SpotifyAudioFeatures>(
				`/audio-features/${spotifyId}`,
			);
			return data;
		} catch {
			return null;
		}
	}

	async enrich(title: string, artist: string, isrc?: string | null) {
		const spotifyId = await this.resolveId(title, artist, isrc);
		if (!spotifyId) return null;
		const af = await this.getAudioFeatures(spotifyId);
		if (!af) return null;
		return { spotifyId, ...af };
	}
}

export const spotifyClient = new SpotifyClient();
