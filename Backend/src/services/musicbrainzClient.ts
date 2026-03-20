import axios from "axios";
import { config } from "../config.js";

// MusicBrainz: 1 req/s rate limit enforced by queue
let lastCall = 0;
async function rateLimit() {
	const wait = Math.max(0, lastCall + 1050 - Date.now());
	if (wait > 0) await new Promise((r) => setTimeout(r, wait));
	lastCall = Date.now();
}

const GENRE_BLOCKLIST = new Set([
	"english",
	"british",
	"american",
	"german",
	"french",
	"seen live",
	"favourites",
	"male vocalists",
	"female vocalists",
]);

class MusicBrainzClient {
	private http = axios.create({
		baseURL: "https://musicbrainz.org/ws/2",
		headers: {
			"User-Agent": config.musicbrainzApp,
			Accept: "application/json",
		},
		timeout: 15_000,
	});

	async enrich(
		title: string,
		artist: string,
	): Promise<{
		mbid: string | null;
		genre: string | null;
		subGenre: string | null;
	}> {
		await rateLimit();
		try {
			const search = await this.http.get<{
				recordings: Array<{
					id: string;
					tags?: Array<{ name: string; count: number }>;
				}>;
			}>("/recording", {
				params: {
					query: `recording:${title} AND artist:${artist}`,
					limit: 1,
					fmt: "json",
				},
			});

			const rec = search.data.recordings?.[0];
			if (!rec) return { mbid: null, genre: null, subGenre: null };

			await rateLimit();
			const detail = await this.http.get<{
				tags?: Array<{ name: string; count: number }>;
			}>(`/recording/${rec.id}`, { params: { inc: "tags", fmt: "json" } });

			const tags = (detail.data.tags ?? [])
				.sort((a, b) => b.count - a.count)
				.map((t) => t.name.toLowerCase())
				.filter((t) => !GENRE_BLOCKLIST.has(t));

			return {
				mbid: rec.id,
				genre: tags[0] ?? null,
				subGenre: tags[1] ?? null,
			};
		} catch {
			return { mbid: null, genre: null, subGenre: null };
		}
	}
}

export const musicbrainzClient = new MusicBrainzClient();
