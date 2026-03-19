import { initSodium } from "@pluralscape/crypto";
import { FilesystemBlobStorageAdapter } from "@pluralscape/storage/filesystem";
import { S3BlobStorageAdapter } from "@pluralscape/storage/s3";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

import { HTTP_CONTENT_TOO_LARGE } from "./http.constants.js";
import { ApiHttpError } from "./lib/api-error.js";
import { getRawClient } from "./lib/db.js";
import { logger } from "./lib/logger.js";
import { initStorageAdapter } from "./lib/storage.js";
import { accessLogMiddleware } from "./middleware/access-log.js";
import { createCorsMiddleware } from "./middleware/cors.js";
import { errorHandler } from "./middleware/error-handler.js";
import { BODY_SIZE_LIMIT_BYTES } from "./middleware/middleware.constants.js";
import { createCategoryRateLimiter, setRateLimitStore } from "./middleware/rate-limit.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { createSecureHeaders } from "./middleware/secure-headers.js";
import { createValkeyStore } from "./middleware/stores/valkey-store.js";
import { v1Routes } from "./routes/v1.js";
import {
  DEFAULT_PORT,
  SERVER_STOP_TIMEOUT_SECONDS,
  SHUTDOWN_TIMEOUT_SECONDS,
} from "./server.constants.js";

const port = Number(process.env["API_PORT"]) || DEFAULT_PORT;

export const app = new Hono();

app.use("*", requestIdMiddleware());
app.use("*", accessLogMiddleware());
app.use("*", createSecureHeaders());
app.use("*", createCorsMiddleware());
app.use(
  "*",
  bodyLimit({
    maxSize: BODY_SIZE_LIMIT_BYTES,
    onError: () => {
      throw new ApiHttpError(
        HTTP_CONTENT_TOO_LARGE,
        "BLOB_TOO_LARGE",
        "Request body exceeds size limit",
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

app.route("/v1", v1Routes);

const MS_PER_SECOND = 1_000;

/**
 * Gracefully shuts down the server and drains the connection pool.
 * Exported for testability — does NOT call process.exit().
 *
 * server.stop() is raced against a timeout — if it hangs, shutdown
 * logs a warning and continues to drain the DB pool regardless.
 */
export async function shutdown(server: { stop(): Promise<void> | void } | null): Promise<void> {
  logger.info("Shutting down");
  if (server) {
    await Promise.race([
      Promise.resolve(server.stop()),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("server.stop() timed out"));
        }, SERVER_STOP_TIMEOUT_SECONDS * MS_PER_SECOND);
      }),
    ]).catch((err: unknown) => {
      logger.warn(
        "server.stop() error during shutdown",
        err instanceof Error ? { err } : { error: String(err) },
      );
    });
  }
  const raw = getRawClient();
  if (raw) await raw.end({ timeout: SHUTDOWN_TIMEOUT_SECONDS });
}

async function start(): Promise<void> {
  // Fail-fast: DISABLE_RATE_LIMIT is a test-only escape hatch. Refuse to start in production with it set.
  if (process.env["DISABLE_RATE_LIMIT"] === "1" && process.env["NODE_ENV"] !== "test") {
    throw new Error("DISABLE_RATE_LIMIT=1 is only allowed when NODE_ENV=test. Refusing to start.");
  }

  await initSodium();

  // Initialize blob storage: prefer S3 if configured, fall back to filesystem
  const s3Bucket = process.env["BLOB_STORAGE_S3_BUCKET"];
  if (s3Bucket) {
    const adapter = new S3BlobStorageAdapter({
      bucket: s3Bucket,
      region: process.env["BLOB_STORAGE_S3_REGION"] ?? "us-east-1",
      endpoint: process.env["BLOB_STORAGE_S3_ENDPOINT"],
      forcePathStyle: process.env["BLOB_STORAGE_S3_FORCE_PATH_STYLE"] === "1",
    });
    initStorageAdapter(adapter);
    // Probe bucket accessibility — logs a warning if credentials or bucket are misconfigured
    // rather than waiting for the first blob operation to fail.
    try {
      await adapter.exists("__healthcheck__" as import("@pluralscape/types").StorageKey);
    } catch (error) {
      logger.warn(
        "S3 blob storage probe failed — check credentials and bucket config",
        error instanceof Error ? { err: error } : { error: String(error) },
      );
    }
  } else {
    const storageRoot = process.env["BLOB_STORAGE_PATH"] ?? "./data/blobs";
    initStorageAdapter(new FilesystemBlobStorageAdapter({ storageRoot }));
  }

  // Resolve rate limit store: prefer Valkey if configured, fall back to in-memory
  const valkeyUrl = process.env["VALKEY_URL"];
  if (valkeyUrl) {
    const store = await createValkeyStore(valkeyUrl);
    if (store) {
      setRateLimitStore(store);
    }
  }

  let httpServer: { stop(): Promise<void> | void } | null = null;

  if (typeof Bun !== "undefined") {
    httpServer = Bun.serve({
      port,
      fetch: app.fetch,
    });

    logger.info("Pluralscape API listening", { port });
  }

  let shutdownInProgress = false;
  const handleShutdown = (): void => {
    if (shutdownInProgress) return;
    shutdownInProgress = true;
    shutdown(httpServer)
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        logger.error("Shutdown failed", err instanceof Error ? { err } : { error: String(err) });
        process.exit(1);
      });
  };
  process.on("SIGTERM", handleShutdown);
  process.on("SIGINT", handleShutdown);
}

void start();
