/**
 * src/api/auth.ts
 *
 * Account + session endpoints. Signup/login issue an HS256 JWT (see src/jwt.ts)
 * whose `sub` is the user's externalId — the same value src/auth.ts reads into
 * request.authUserId and that ownership checks (ensureSelf) compare against.
 */
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { config } from "../config.js";
import { signToken } from "../jwt.js";
import { hashPassword, verifyPassword } from "../password.js";
import {
	createAccount,
	resolveUser,
	resolveUserByEmail,
} from "../db/repositories/users.js";
import type { User } from "../db/repositories/users.js";

const signupSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8, "Password must be at least 8 characters"),
	displayName: z.string().trim().min(1).max(60),
});

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
});

/** Shape returned to the client — never includes the password hash. */
function publicUser(user: User) {
	return {
		id: user.externalId,
		email: user.email,
		displayName: user.displayName,
	};
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
	app.post("/auth/signup", async (req, reply) => {
		const parsed = signupSchema.safeParse(req.body);
		if (!parsed.success) {
			return reply
				.status(400)
				.send({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
		}
		const { email, password, displayName } = parsed.data;

		const existing = await resolveUserByEmail(email);
		if (existing) {
			return reply.status(409).send({ error: "Email already registered" });
		}

		const passwordHash = await hashPassword(password);
		const user = await createAccount({
			id: randomUUID(),
			email,
			passwordHash,
			displayName,
		});

		const token = signToken(user.externalId);
		return reply.status(201).send({
			token,
			tokenType: "Bearer",
			expiresIn: config.jwtTtlSec,
			user: publicUser(user),
		});
	});

	app.post("/auth/login", async (req, reply) => {
		const parsed = loginSchema.safeParse(req.body);
		if (!parsed.success) {
			return reply.status(400).send({ error: "Invalid input" });
		}
		const { email, password } = parsed.data;

		const user = await resolveUserByEmail(email);
		const ok = user && (await verifyPassword(password, user.passwordHash));
		if (!user || !ok) {
			return reply.status(401).send({ error: "Invalid email or password" });
		}

		const token = signToken(user.externalId);
		return {
			token,
			tokenType: "Bearer",
			expiresIn: config.jwtTtlSec,
			user: publicUser(user),
		};
	});

	app.get("/auth/me", async (req, reply) => {
		const user = await resolveUser(req.authUserId);
		if (!user) {
			return reply.status(401).send({ error: "Not authenticated" });
		}
		return { user: publicUser(user) };
	});
}
