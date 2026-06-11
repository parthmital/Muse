/**
 * src/jwt.ts
 *
 * Minimal HS256 JWT sign/verify on top of Node's crypto — no external dep.
 * Enough to back a real session/identity layer; pairs with src/auth.ts which
 * prefers a valid Bearer token but stays backwards-compatible with the legacy
 * single-user `x-user-id` header.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";

export interface JwtPayload {
	sub: string;
	iat: number;
	exp: number;
	[key: string]: unknown;
}

function sign(data: string): string {
	return createHmac("sha256", config.jwtSecret)
		.update(data)
		.digest("base64url");
}

export function signToken(sub: string, ttlSec = config.jwtTtlSec): string {
	const header = Buffer.from(
		JSON.stringify({ alg: "HS256", typ: "JWT" }),
	).toString("base64url");
	const now = Math.floor(Date.now() / 1000);
	const payload = Buffer.from(
		JSON.stringify({ sub, iat: now, exp: now + ttlSec }),
	).toString("base64url");
	const data = `${header}.${payload}`;
	return `${data}.${sign(data)}`;
}

export function verifyToken(token: string): JwtPayload | null {
	const parts = token.split(".");
	if (parts.length !== 3) return null;
	const [header, payload, signature] = parts;
	const data = `${header}.${payload}`;

	const expected = Buffer.from(sign(data));
	const provided = Buffer.from(signature);
	if (expected.length !== provided.length) return null;
	if (!timingSafeEqual(expected, provided)) return null;

	try {
		const decoded = JSON.parse(
			Buffer.from(payload, "base64url").toString("utf8"),
		) as JwtPayload;
		if (!decoded.sub) return null;
		if (
			typeof decoded.exp === "number" &&
			decoded.exp < Math.floor(Date.now() / 1000)
		) {
			return null;
		}
		return decoded;
	} catch {
		return null;
	}
}
