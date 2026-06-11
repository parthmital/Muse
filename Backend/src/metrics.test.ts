import { describe, it, expect } from "vitest";
import { incr, snapshot } from "./metrics.js";

describe("metrics", () => {
	it("counts and accumulates by name", () => {
		const name = `test_counter_${Math.floor(performance.now())}`;
		incr(name);
		incr(name, 3);
		expect(snapshot()[name]).toBe(4);
	});

	it("returns a sorted snapshot", () => {
		incr("zzz_metric");
		incr("aaa_metric");
		const keys = Object.keys(snapshot());
		const sorted = [...keys].sort();
		expect(keys).toEqual(sorted);
	});
});
