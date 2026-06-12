import { describe, it, expect } from "vitest";
import {
	parseTitle,
	normalizeName,
	titleSimilarity,
	nameSimilarity,
	pickBest,
	keyFragment,
	type ScoredCandidate,
} from "./matching.js";

describe("parseTitle", () => {
	it("strips featuring credits and punctuation", () => {
		expect(parseTitle("Stronger (feat. Kanye West)").base).toBe("stronger");
		expect(parseTitle("Señorita").base).toBe("senorita");
	});

	it("drops ignorable reissue noise without flagging a variant", () => {
		const p = parseTitle("Bohemian Rhapsody - Remastered 2011");
		expect(p.base).toBe("bohemian rhapsody 2011");
		expect(p.variants.size).toBe(0);
	});

	it("captures meaningful version tags", () => {
		expect([...parseTitle("Shape of You (Remix)").variants]).toContain("remix");
		expect([...parseTitle("Hotel California - Live").variants]).toContain(
			"live",
		);
	});
});

describe("normalizeName", () => {
	it("folds 'the' prefix, ampersand and accents", () => {
		expect(normalizeName("The Beatles")).toBe("beatles");
		expect(normalizeName("Simon & Garfunkel")).toBe("simon and garfunkel");
		expect(normalizeName("Beyoncé")).toBe("beyonce");
	});
});

describe("titleSimilarity", () => {
	it("scores an exact (reissue-noise) match as identical", () => {
		expect(
			titleSimilarity("Bohemian Rhapsody", "Bohemian Rhapsody (Remastered)"),
		).toBe(1);
	});

	it("penalizes a meaningful version mismatch", () => {
		// Studio asked, remix offered — must score below a clean match.
		expect(
			titleSimilarity("Shape of You", "Shape of You (Remix)"),
		).toBeLessThan(0.8);
	});

	it("does not conflate distinct titles that share a word", () => {
		// The old Jaccard approach scored this 0.5; edit-distance keeps it low.
		expect(titleSimilarity("Love", "Love Story")).toBeLessThan(0.6);
	});
});

describe("nameSimilarity", () => {
	it("matches across casing/accents/the-prefix", () => {
		expect(nameSimilarity("the weeknd", "The Weeknd")).toBe(1);
		expect(nameSimilarity("Beyonce", "Beyoncé")).toBe(1);
	});
});

describe("pickBest", () => {
	const c = (
		id: number,
		score: number,
		popularity: number,
	): ScoredCandidate<{ id: number }> => ({
		item: { id },
		score,
		popularity,
	});

	it("returns null when nothing clears the threshold", () => {
		expect(pickBest([c(1, 0.4, 100)], 0.6)).toBeNull();
	});

	it("breaks near-ties by popularity (prefers the canonical release)", () => {
		const best = pickBest([c(1, 0.98, 10), c(2, 0.96, 900)], 0.6);
		expect(best?.item.id).toBe(2);
	});

	it("does not let popularity override a clearly better score", () => {
		const best = pickBest([c(1, 0.95, 10), c(2, 0.65, 900)], 0.6);
		expect(best?.item.id).toBe(1);
	});
});

describe("keyFragment", () => {
	it("produces a stable key across trivial variation", () => {
		expect(keyFragment("Bohemian Rhapsody (Remastered 2011)")).toBe(
			keyFragment("bohemian rhapsody - remastered 2011"),
		);
	});
});
