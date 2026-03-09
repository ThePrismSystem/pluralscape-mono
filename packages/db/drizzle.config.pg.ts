import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/pg/index.ts",
  out: "./migrations/pg",
  dialect: "postgresql",
});
