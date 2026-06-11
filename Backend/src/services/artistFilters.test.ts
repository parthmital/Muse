import { describe, it, expect } from "vitest";
import { isCompilationArtist } from "./artistFilters.js";

describe("isCompilationArtist", () => {
	it("treats empty / missing names as compilations", () => {
		expect(isCompilationArtist(null)).toBe(true);
		expect(isCompilationArtist(undefined)).toBe(true);
		expect(isCompilationArtist("   ")).toBe(true);
	});

	it("flags compilation / various-artist / chart pseudo-names", () => {
		for (const name of [
			"Various Artists",
			"90's Rock Hits",
			"Top 40 Pop",
			"#1 Hits Now",
			"Now That's What I Call Music",
			"Karaoke Classics",
			"Sleep Music",
			"Lo-Fi Study Beats",
		]) {
			expect(isCompilationArtist(name), name).toBe(true);
		}
	});

	it("keeps real artists", () => {
		for (const name of [
			"Ariana Grande",
			"Michael Jackson",
			"Radiohead",
			"Tyler, The Creator",
			"BTS",
		]) {
			expect(isCompilationArtist(name), name).toBe(false);
		}
	});
});
