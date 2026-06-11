import { describe, it, expect } from "vitest";
import { toJson, fromJson } from "./helpers.js";

describe("toJson / fromJson", () => {
	it("round-trips objects", () => {
		const value = { a: 1, b: ["x", "y"], c: { d: true } };
		expect(fromJson(toJson(value), null)).toEqual(value);
	});

	it("returns the fallback for null/undefined/empty", () => {
		expect(fromJson(null, "fb")).toBe("fb");
		expect(fromJson(undefined, 42)).toBe(42);
		expect(fromJson("", [])).toEqual([]);
	});

	it("returns the fallback for malformed JSON instead of throwing", () => {
		expect(fromJson("{not valid", { ok: true })).toEqual({ ok: true });
	});
});
