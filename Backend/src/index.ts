import Fastify from "fastify";
import axios from "axios";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { config } from "./config.js";
import { interactionsRoutes } from "./api/interactions.js";
import { recommendationRoutes } from "./api/recommendations.js";
import { trackRoutes } from "./api/tracks.js";
import { userRoutes } from "./api/users.js";
import { tidalRoutes } from "./api/tidal.js";
import { libraryRoutes } from "./api/library.js";
import { browseRoutes } from "./api/browse.js";
import { contextMenuRoutes } from "./api/contextMenu.js";
import { actionRoutes } from "./api/actions.js";
import { lastfmRoutes } from "./api/lastfm.js";
import { authRoutes } from "./api/auth.js";
import { prisma, initDb, disconnectDb } from "./db/prisma.js";
import { ensureUser } from "./db/repositories/users.js";
import { registerAuth } from "./auth.js";
import { observe } from "./metrics.js";

const app = Fastify({
	logger: {
		level: config.logLevel,
		transport:
			config.nodeEnv === "development"
				? { target: "pino-pretty", options: { colorize: true } }
				: undefined,
	},
});

// Initialize DB (pragmas), report dataset size, ensure dev user
try {
	await initDb();

	const [tracks, artists, albums] = await Promise.all([
		prisma.track.count(),
		prisma.artist.count(),
		prisma.album.count(),
	]);

	app.log.info({ tracks, artists, albums }, "Dataset row counts at startup");

	if (tracks === 0 && artists === 0) {
		app.log.warn(
			"Dataset appears empty. Homepage recommendations may return no items until ingestion/sync runs.",
		);
	}

	await ensureUser(config.devUserId, config.devUserId, 0);

	// Check Tidal-API health
	try {
		await axios.get(`${config.tidalApiBaseUrl}/`, { timeout: 2000 });
		app.log.info(
			{ tidalApiBaseUrl: config.tidalApiBaseUrl },
			"Tidal-API is reachable",
		);
	} catch (e: any) {
		app.log.warn(
			{ tidalApiBaseUrl: config.tidalApiBaseUrl, error: e?.message },
			"Tidal-API is unreachable during startup health check",
		);
	}
} catch (e) {
	app.log.error({ error: e }, "Initialization error");
}

await app.register(cors, { origin: true });

// Identity boundary — decorates request.authUserId (see src/auth.ts).
registerAuth(app);

// ── Per-route latency timing (p50/p95/p99 surfaced at /metrics) ─────────────
app.addHook("onRequest", async (req) => {
	(req as unknown as { _startNs: bigint })._startNs = process.hrtime.bigint();
});
app.addHook("onResponse", async (req) => {
	const start = (req as unknown as { _startNs?: bigint })._startNs;
	if (start !== undefined) {
		const ms = Number(process.hrtime.bigint() - start) / 1e6;
		const route =
			(req as unknown as { routeOptions?: { url?: string } }).routeOptions
				?.url ??
			(req as unknown as { routerPath?: string }).routerPath ??
			req.url.split("?")[0];
		observe(`http ${req.method} ${route}`, ms);
	}
});

// ── Browser/proxy cache-control for read-only routes ────────────────────────
function cacheControlFor(method: string, url: string): string | null {
	if (method !== "GET") return null;
	const path = url.split("?")[0];
	// Stream manifests carry short-lived signed CDN URLs — never cache.
	if (path.includes("/stream")) return "private, no-store";
	// Personalized / mutable surfaces.
	if (
		path.startsWith("/users/") ||
		path === "/library" ||
		path.startsWith("/playlists") ||
		path.startsWith("/browse/recent-searches") ||
		path.startsWith("/context-menu") ||
		path.startsWith("/auth") ||
		path === "/metrics" ||
		path === "/health"
	) {
		return "private, no-store";
	}
	// Catalog metadata is effectively immutable — cache hard, revalidate lazily.
	if (
		path.startsWith("/tidal/albums/") ||
		path.startsWith("/tidal/artists/") ||
		path.startsWith("/tidal/tracks/") ||
		path.startsWith("/tidal/mixes/") ||
		path.startsWith("/tidal/playlists/")
	) {
		return "public, max-age=3600, stale-while-revalidate=86400";
	}
	// Discovery surfaces change more often but tolerate brief staleness.
	if (
		path.startsWith("/tidal/genres") ||
		path.startsWith("/tidal/genre-albums") ||
		path.startsWith("/tidal/search") ||
		path.startsWith("/lastfm/") ||
		path.startsWith("/browse/")
	) {
		return "public, max-age=300, stale-while-revalidate=3600";
	}
	return null;
}

app.addHook("onSend", async (req, reply, payload) => {
	if (!reply.getHeader("Cache-Control")) {
		const cc = cacheControlFor(req.method, req.url);
		if (cc) reply.header("Cache-Control", cc);
	}
	return payload;
});

await app.register(swagger, {
	openapi: {
		info: { title: "Music Rec Engine", version: "3.0.0" },
	},
});
await app.register(swaggerUi, { routePrefix: "/docs" });

// ── Routes ────────────────────────────────────────────────────────────────────
await app.register(interactionsRoutes);
await app.register(recommendationRoutes);
await app.register(trackRoutes);
await app.register(userRoutes);
await app.register(tidalRoutes);
await app.register(libraryRoutes);
await app.register(browseRoutes);
await app.register(contextMenuRoutes);
await app.register(actionRoutes);
await app.register(lastfmRoutes);
await app.register(authRoutes);

app.setErrorHandler((error, request, reply) => {
	app.log.error(
		{
			error,
			method: request.method,
			url: request.url,
			requestId: request.id,
		},
		"Unhandled API error",
	);

	if (reply.sent) return;
	reply.status(error.statusCode ?? 500).send({
		error: "Internal server error",
		requestId: request.id,
	});
});

app.setNotFoundHandler((request, reply) => {
	app.log.warn(
		{
			method: request.method,
			url: request.url,
			requestId: request.id,
		},
		"Route not found",
	);
	reply.status(404).send({ error: "Not found", requestId: request.id });
});

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/health", async () => {
	return { status: "ok" };
});

// ── Metrics ───────────────────────────────────────────────────────────────────
app.get("/metrics", async () => {
	const { snapshot } = await import("./metrics.js");
	return snapshot();
});

// ── Start ─────────────────────────────────────────────────────────────────────
try {
	await app.listen({ port: config.port, host: "0.0.0.0" });
	app.log.info(`API listening on port ${config.port}`);
} catch (err) {
	app.log.error(err);
	process.exit(1);
}

process.on("unhandledRejection", (reason) => {
	app.log.error({ reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (error) => {
	app.log.fatal({ error }, "Uncaught exception");
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => {
		app.log.info({ signal }, "Shutting down");
		void app
			.close()
			.then(() => disconnectDb())
			.finally(() => process.exit(0));
	});
}
