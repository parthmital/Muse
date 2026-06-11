/**
 * src/api/auth.ts
 *
 * Session-token endpoints backing the JWT identity scaffold. Single-tenant for
 * now: /auth/token mints a token for a user id with no password challenge. A
 * real deployment gates this behind an identity provider, but the token format,
 * verification, and request-identity wiring (src/auth.ts) are already real.
 */
import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { signToken } from "../jwt.js";
import { ensureUser } from "../db/repositories/users.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
	app.post<{ Body: { userId?: string } }>("/auth/token", async (req) => {
		const userId = (req.body?.userId || config.devUserId).trim();
		await ensureUser(userId, userId, 1);
		const token = signToken(userId);
		return { token, userId, tokenType: "Bearer", expiresIn: config.jwtTtlSec };
	});

	app.get("/auth/me", async (req) => {
		return { userId: req.authUserId };
	});
}
