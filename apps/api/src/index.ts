import { Hono } from "hono";

import { corsMiddleware } from "./middleware/cors.js";
import { errorHandler } from "./middleware/error-handler.js";
import { secureHeaders } from "./middleware/secure-headers.js";

const DEFAULT_PORT = 10045;
const port = Number(process.env["API_PORT"]) || DEFAULT_PORT;

const app = new Hono();

app.use("*", secureHeaders);
app.use("*", corsMiddleware);
app.onError(errorHandler);

app.get("/", (c) => {
  return c.json({ status: "ok", service: "pluralscape-api" });
});

app.get("/health", (c) => {
  return c.json({ status: "healthy" });
});

Bun.serve({
  port,
  fetch: app.fetch,
});

console.info(`Pluralscape API listening on port ${String(port)}`);
