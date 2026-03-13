/**
 * CLI script to apply all RLS policies to the PostgreSQL database.
 *
 * Usage: tsx scripts/apply-rls.ts
 * Requires DATABASE_URL environment variable.
 */

import postgres from "postgres";

import { applyAllRls } from "../src/rls/apply.js";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = postgres(connectionString);

const executor = {
  async execute(statement: string): Promise<void> {
    await sql.unsafe(statement);
  },
};

try {
  console.info("Applying RLS policies to all tables...");
  await applyAllRls(executor);
  console.info("RLS policies applied successfully.");
} finally {
  await sql.end();
}
