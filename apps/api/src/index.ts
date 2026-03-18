import { initSodium } from "@pluralscape/crypto";
import { FilesystemBlobStorageAdapter } from "@pluralscape/storage/filesystem";
import { S3BlobStorageAdapter } from "@pluralscape/storage/s3";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

import { HTTP_CONTENT_TOO_LARGE } from "./http.constants.js";
import { ApiHttpError } from "./lib/api-error.js";
import { logger } from "./lib/logger.js";
import { initStorageAdapter } from "./lib/storage.js";
import { createCorsMiddleware } from "./middleware/cors.js";
import { errorHandler } from "./middleware/error-handler.js";
import { BODY_SIZE_LIMIT_BYTES } from "./middleware/middleware.constants.js";
import { createCategoryRateLimiter, setRateLimitStore } from "./middleware/rate-limit.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { createSecureHeaders } from "./middleware/secure-headers.js";
import { createValkeyStore } from "./middleware/stores/valkey-store.js";
import { accountRoutes } from "./routes/account/index.js";
import { authRoutes } from "./routes/auth/index.js";
import { systemRoutes } from "./routes/systems/index.js";
import { DEFAULT_PORT } from "./server.constants.js";

const port = Number(process.env["API_PORT"]) || DEFAULT_PORT;

export const app = new Hono();

app.use("*", requestIdMiddleware());
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

app.route("/account", accountRoutes);
app.route("/auth", authRoutes);
app.route("/systems", systemRoutes);

async function start(): Promise<void> {
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
      logger.warn("S3 blob storage probe failed — check credentials and bucket config", {
        error: error instanceof Error ? error.message : String(error),
      });
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

  if (typeof Bun !== "undefined") {
    Bun.serve({
      port,
      fetch: app.fetch,
    });

    logger.info("Pluralscape API listening", { port });
  }
}

void start();
