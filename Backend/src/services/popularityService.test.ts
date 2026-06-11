import { describe, it, expect, vi, beforeEach } from "vitest";
import type { HifiTrack } from "./hifiClient.js";

// Mock the Tidal proxy client and the DB so the test is hermetic — we only
// exercise the pure relevance-matching logic in searchTidalTrack.
const searchTracks = vi.fn();
vi.mock("./hifiClient.js", () => ({
	hifiClient: { searchTracks: (...args: unknown[]) => searchTracks(...args) },
}));
vi.mock("../db/prisma.js", () => ({ prisma: {} }));
vi.mock("./lastfmClient.js", () => ({ lastfmClient: {} }));

const { searchTidalTrack } = await import("./popularityService.js");

function track(id: number, title: string, artist: string): HifiTrack {
	return { id, title, artist: { id: id * 10, name: artist } };
}

describe("searchTidalTrack relevance gate", () => {
	beforeEach(() => searchTracks.mockReset());

	it("returns the matching track when one clears the threshold", async () => {
		searchTracks.mockResolvedValue({
			items: [
				track(1, "Some Unrelated Song", "Other Artist"),
				track(2, "Stronger", "Kanye West"),
			],
		});
		const result = await searchTidalTrack("Stronger", "Kanye West");
		expect(result?.id).toBe(2);
	});

	it("returns null when nothing clears the threshold (no items[0] fallback)", async () => {
		// A poisoned/keyword query: results are real tracks but none match the
		// requested title+artist. Must NOT resolve to the first result.
		searchTracks.mockResolvedValue({
			items: [
				track(10, "Viral", "Kolyon"),
				track(11, "Trending Topic", "Young Pappy"),
				track(12, "New Age Piano Music for Sleeping", "Sleep Music Lullabies"),
			],
		});
		const result = await searchTidalTrack("Stronger", "Kanye West");
		expect(result).toBeNull();
	});

	it("returns null on empty search results", async () => {
		searchTracks.mockResolvedValue({ items: [] });
		expect(await searchTidalTrack("Stronger", "Kanye West")).toBeNull();
	});
});
