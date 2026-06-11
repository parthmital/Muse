import { describe, it, expect, vi } from "vitest";
import type { FastifyReply, FastifyRequest } from "fastify";
import { authorizedFor, ensureSelf } from "./auth.js";

const req = (authUserId: string) => ({ authUserId }) as FastifyRequest;

function fakeReply() {
	const reply = {
		statusCode: 0,
		body: undefined as unknown,
		status(code: number) {
			this.statusCode = code;
			return this;
		},
		send(payload: unknown) {
			this.body = payload;
			return this;
		},
	};
	return reply as unknown as FastifyReply & {
		statusCode: number;
		body: unknown;
	};
}

describe("auth", () => {
	it("authorizedFor matches the caller's identity", () => {
		expect(authorizedFor(req("u1"), "u1")).toBe(true);
		expect(authorizedFor(req("u1"), "u2")).toBe(false);
	});

	it("ensureSelf allows the owner without replying", () => {
		const reply = fakeReply();
		const send = vi.spyOn(reply, "send");
		expect(ensureSelf(req("u1"), reply, "u1")).toBe(true);
		expect(send).not.toHaveBeenCalled();
	});

	it("ensureSelf rejects others with 403", () => {
		const reply = fakeReply();
		expect(ensureSelf(req("u1"), reply, "u2")).toBe(false);
		expect(reply.statusCode).toBe(403);
		expect(reply.body).toEqual({ error: "Forbidden" });
	});
});
