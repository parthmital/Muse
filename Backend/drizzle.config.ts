import type { Config } from "drizzle-kit";

export default {
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "sqlite",
	dbCredentials: {
		url: process.env.SQLITE_PATH ?? "./data/music_rec.db",
	},
} satisfies Config;
