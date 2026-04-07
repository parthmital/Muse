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
import { db, runMigrations } from "./db/client.js";
import { resolveUser } from "./db/helpers.js";
import { embeddingClient } from "./services/embeddingClient.js";

const app = Fastify({
	logger: {
		level: config.logLevel,
		transport:
			config.nodeEnv === "development"
				? { target: "pino-pretty", options: { colorize: true } }
				: undefined,
	},
});

// Run DB migrations and ensure dev user
try {
	runMigrations();

	const tableCounts = {
		tracks: db.prepare("SELECT COUNT(*) as c FROM tracks").get() as {
			c: number;
		},
		artists: db.prepare("SELECT COUNT(*) as c FROM artists").get() as {
			c: number;
		},
		albums: db.prepare("SELECT COUNT(*) as c FROM albums").get() as {
			c: number;
		},
	};

	app.log.info(
		{
			tracks: tableCounts.tracks.c,
			artists: tableCounts.artists.c,
			albums: tableCounts.albums.c,
		},
		"Dataset row counts at startup",
	);

	if (tableCounts.tracks.c === 0 && tableCounts.artists.c === 0) {
		app.log.warn(
			"Dataset appears empty. Homepage recommendations may return no items until ingestion/sync runs.",
		);
	}

	const DEV_USER_ID = "dev-user-001";
	const existing = resolveUser(DEV_USER_ID);

	if (!existing) {
		app.log.info("Initializing dev user");
		db.prepare(
			"INSERT OR IGNORE INTO users (id, external_id, is_new) VALUES (?, ?, 0)",
		).run(DEV_USER_ID, DEV_USER_ID);
		db.prepare(
			"INSERT OR IGNORE INTO user_profiles (user_id, profile_vector, total_play_count) VALUES (?, '[]', 0)",
		).run(DEV_USER_ID);
	}

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
	const embHealth = await embeddingClient.health();
	return {
		status: "ok",
		embedding: embHealth ?? { status: "unreachable" },
	};
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
