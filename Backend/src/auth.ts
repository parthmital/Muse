/**
 * src/auth.ts
 *
 * Minimal identity boundary. There is no real authentication yet (single-user
 * dev mode), but this gives the rest of the app ONE place to read the caller's
 * identity (`request.authUserId`) and ONE helper to authorize access to a
 * resource owned by a given external id, instead of hardcoding the dev user in
 * route handlers.
 *
 * Identity is taken from the `x-user-id` header and falls back to
 * config.devUserId, so existing clients (which send no header) keep working.
 * Replacing this with JWT/session auth later means changing only this file.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.js";

declare module "fastify" {
	interface FastifyRequest {
		authUserId: string;
	}
}

/**
 * Wire identity onto the root Fastify instance. Must be called on the root app
 * (not inside an encapsulated plugin) so the hook applies to every route.
 */
export function registerAuth(app: FastifyInstance): void {
	app.decorateRequest("authUserId", "");
	app.addHook("onRequest", async (req: FastifyRequest) => {
		const header = req.headers["x-user-id"];
		const value = Array.isArray(header) ? header[0] : header;
		req.authUserId = value?.trim() || config.devUserId;
	});
}

/** True if the caller is allowed to act as `externalId`. */
export function authorizedFor(
	req: FastifyRequest,
	externalId: string,
): boolean {
	return req.authUserId === externalId;
}

/**
 * Guard a route that targets `externalId`: replies 403 and returns false when
 * the caller isn't that user. Returns true when access is allowed.
 */
export function ensureSelf(
	req: FastifyRequest,
	reply: FastifyReply,
	externalId: string,
): boolean {
	if (authorizedFor(req, externalId)) return true;
	reply.status(403).send({ error: "Forbidden" });
	return false;
}
