import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password", () => {
	it("verifies a correct password", async () => {
		const hash = await hashPassword("correct horse battery staple");
		expect(await verifyPassword("correct horse battery staple", hash)).toBe(
			true,
		);
	});

	it("rejects an incorrect password", async () => {
		const hash = await hashPassword("correct horse battery staple");
		expect(await verifyPassword("wrong password", hash)).toBe(false);
	});

	it("produces a salted hash (different each time)", async () => {
		const a = await hashPassword("same");
		const b = await hashPassword("same");
		expect(a).not.toBe(b);
		expect(await verifyPassword("same", a)).toBe(true);
		expect(await verifyPassword("same", b)).toBe(true);
	});

	it("returns false for empty/malformed stored values", async () => {
		expect(await verifyPassword("x", null)).toBe(false);
		expect(await verifyPassword("x", "")).toBe(false);
		expect(await verifyPassword("x", "no-colon")).toBe(false);
	});
});
