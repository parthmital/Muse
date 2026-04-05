type LogLevel = "debug" | "info" | "warn" | "error";

function formatError(error: unknown) {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
		};
	}
	return error;
}

function shouldLogDebug() {
	return process.env.NODE_ENV !== "production";
}

function write(
	level: LogLevel,
	scope: string,
	message: string,
	meta?: unknown,
) {
	if (level === "debug" && !shouldLogDebug()) {
		return;
	}

	const payload = {
		timestamp: new Date().toISOString(),
		scope,
		message,
		meta,
	};

	if (level === "error") {
		console.error(payload);
		return;
	}
	if (level === "warn") {
		console.warn(payload);
		return;
	}
	if (level === "info") {
		console.info(payload);
		return;
	}
	console.debug(payload);
}

export const logger = {
	debug(scope: string, message: string, meta?: unknown) {
		write("debug", scope, message, meta);
	},
	info(scope: string, message: string, meta?: unknown) {
		write("info", scope, message, meta);
	},
	warn(scope: string, message: string, meta?: unknown) {
		write("warn", scope, message, meta);
	},
	error(scope: string, message: string, error?: unknown, meta?: unknown) {
		write("error", scope, message, {
			error: formatError(error),
			...((meta as Record<string, unknown>) ?? {}),
		});
	},
};
