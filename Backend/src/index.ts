import Fastify from "fastify";
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
import { runMigrations } from "./db/client.js";
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

// Run DB migrations
try {
	runMigrations();
} catch (e) {
	console.error("Migration error:", e);
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
