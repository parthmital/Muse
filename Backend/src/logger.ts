/**
 * src/logger.ts
 *
 * Shared Pino logger for code outside the Fastify request lifecycle (services,
 * workers, startup). Routes should continue to use the request-bound logger
 * (request.log) for request correlation; everything else uses this. Replaces
 * the ad-hoc console.log/warn/error calls scattered across services.
 */
import { pino } from "pino";
import { config } from "./config.js";

export const logger = pino({
	level: config.logLevel,
	transport:
		config.nodeEnv === "development"
			? { target: "pino-pretty", options: { colorize: true } }
			: undefined,
});

export type Logger = typeof logger;
