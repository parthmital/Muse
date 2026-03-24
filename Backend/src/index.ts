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

	const DEV_USER_ID = "dev-user-001";
	const existing = resolveUser(DEV_USER_ID);

	if (!existing) {
		console.log("Initializing dev user...");
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
		console.log(`[Health] Tidal-API is UP at ${config.tidalApiBaseUrl}`);
	} catch (e: any) {
		console.warn(
			`[Health] Tidal-API is UNREACHABLE at ${config.tidalApiBaseUrl}: ${e.message}`,
		);
	}
} catch (e) {
	console.error("Initialization error:", e);
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
