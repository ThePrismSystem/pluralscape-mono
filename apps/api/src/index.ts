import { Hono } from "hono";

import { createCorsMiddleware } from "./middleware/cors.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createRateLimiter } from "./middleware/rate-limit.js";
import { createSecureHeaders } from "./middleware/secure-headers.js";

const DEFAULT_PORT = 10045;
const port = Number(process.env["API_PORT"]) || DEFAULT_PORT;

export const app = new Hono();

app.use("*", createSecureHeaders());
app.use("*", createCorsMiddleware());
// Global rate limit: 100 req/60s. Auth routes need stricter limits.
app.use("*", createRateLimiter({ limit: 100, windowMs: 60_000 }));
app.onError(errorHandler);

app.get("/", (c) => {
  return c.json({ status: "ok", service: "pluralscape-api" });
});

app.get("/health", (c) => {
  return c.json({ status: "healthy" });
});

if (typeof Bun !== "undefined") {
  Bun.serve({
    port,
    fetch: app.fetch,
  });

  console.info(`Pluralscape API listening on port ${String(port)}`);
}
