/**
 * Apply database migrations for E2E tests using Drizzle's migrator.
 *
 * Invoked as: bun apps/api-e2e/src/migrate.ts <database-url>
 *
 * Uses Drizzle's built-in migrate() function which handles parameterized
 * CHECK constraint SQL correctly (unlike drizzle-kit push or raw SQL execution).
 */
import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.argv[2];
if (!databaseUrl) {
  console.error("Usage: bun apps/api-e2e/src/migrate.ts <database-url>");
  process.exit(1);
}

const migrationsFolder = path.resolve(import.meta.dirname, "../../../packages/db/migrations/pg");

const sql = postgres(databaseUrl, { max: 1 });
const db = drizzle(sql);

await migrate(db, { migrationsFolder });
await sql.end();

console.info("[e2e] Migrations applied successfully.");
