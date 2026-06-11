// Prisma 7 CLI configuration (migrate / db push / studio).
// The DB URL is derived from the same SQLITE_PATH the runtime uses (resolved to
// an absolute path so the CLI and the better-sqlite3 driver adapter agree),
// falling back to an explicit DATABASE_URL if one is set.
import "dotenv/config";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

const sqlitePath = process.env.SQLITE_PATH ?? "./data/music_rec.db";
const url = process.env.DATABASE_URL ?? `file:${resolve(sqlitePath)}`;

export default defineConfig({
	schema: "prisma/schema.prisma",
	datasource: { url },
});
