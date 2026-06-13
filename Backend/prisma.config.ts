// Prisma 7 CLI configuration (migrate / db push / studio).
// Prisma 7 no longer reads the datasource URL from the schema, so the CLI gets
// it from here (DATABASE_URL). The application runtime connects via the pg
// driver adapter in src/db/prisma.ts using the same DATABASE_URL.
import "dotenv/config";
import { defineConfig } from "prisma/config";

const url =
	process.env.DATABASE_URL ??
	"postgresql://postgres:postgres@localhost:5432/muse";

export default defineConfig({
	schema: "prisma/schema.prisma",
	datasource: { url },
});
