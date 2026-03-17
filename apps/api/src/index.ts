import { initSodium } from "@pluralscape/crypto";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

import { HTTP_CONTENT_TOO_LARGE } from "./http.constants.js";
import { createCorsMiddleware } from "./middleware/cors.js";
import { errorHandler } from "./middleware/error-handler.js";
import { BODY_SIZE_LIMIT_BYTES } from "./middleware/middleware.constants.js";
import { createCategoryRateLimiter } from "./middleware/rate-limit.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { createSecureHeaders } from "./middleware/secure-headers.js";
import { authRoutes } from "./routes/auth/index.js";
import { systemRoutes } from "./routes/systems/index.js";

const DEFAULT_PORT = 10045;
const port = Number(process.env["API_PORT"]) || DEFAULT_PORT;

export const app = new Hono();

app.use("*", requestIdMiddleware());
app.use("*", createSecureHeaders());
app.use("*", createCorsMiddleware());
app.use(
  "*",
  bodyLimit({
    maxSize: BODY_SIZE_LIMIT_BYTES,
    onError: (c) => {
      return c.json(
        { error: { code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds size limit" } },
        HTTP_CONTENT_TOO_LARGE,
      );
    },
  }),
);
app.use("*", createCategoryRateLimiter("global"));
app.onError(errorHandler);

app.get("/", (c) => {
  return c.json({ status: "ok", service: "pluralscape-api" });
});

app.get("/health", (c) => {
  return c.json({ status: "healthy" });
});

app.route("/auth", authRoutes);
app.route("/systems", systemRoutes);

async function start(): Promise<void> {
  await initSodium();

  if (typeof Bun !== "undefined") {
    Bun.serve({
      port,
      fetch: app.fetch,
    });

    console.info(`Pluralscape API listening on port ${String(port)}`);
  }
}

void start();
