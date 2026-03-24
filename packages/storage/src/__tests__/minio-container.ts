/**
 * Manages a MinIO Docker container for S3 integration tests.
 *
 * Usage (in test setup):
 *   const ctx = await ensureMinio();
 *   if (!ctx.available) return; // skip tests
 *   afterAll(() => ctx.cleanup());
 *
 * The container is named `pluralscape-minio-test` and reused across runs.
 */
import { execSync } from "node:child_process";

import type { S3AdapterConfig } from "../adapters/s3/s3-config.js";

const CONTAINER_NAME = "pluralscape-minio-test";
const MINIO_PORT = Number(process.env["TEST_MINIO_PORT"]) || 10_943;
const CONNECT_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 500;
const ACCESS_KEY = "minioadmin";
const SECRET_KEY = "minioadmin";
const TEST_BUCKET = "pluralscape-test";

function exec(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function isContainerRunning(): boolean {
  const result = exec(`docker ps --filter name=${CONTAINER_NAME} --format "{{.Status}}"`);
  return result.startsWith("Up");
}

function startContainer(): boolean {
  // Check if container exists but is stopped
  const exists = exec(`docker ps -a --filter name=${CONTAINER_NAME} --format "{{.ID}}"`);
  if (exists) {
    exec(`docker start ${CONTAINER_NAME}`);
    return isContainerRunning();
  }

  // Create new container
  const result = exec(
    `docker run -d --name ${CONTAINER_NAME} ` +
      `-p ${String(MINIO_PORT)}:9000 ` +
      `-e MINIO_ROOT_USER=${ACCESS_KEY} ` +
      `-e MINIO_ROOT_PASSWORD=${SECRET_KEY} ` +
      `minio/minio:latest server /data`,
  );
  return result.length > 0;
}

async function waitForReady(): Promise<boolean> {
  const endpoint = `http://localhost:${String(MINIO_PORT)}/minio/health/live`;
  const deadline = Date.now() + CONNECT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return true;
    } catch {
      // Not ready yet
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, POLL_INTERVAL_MS);
    });
  }
  return false;
}

function ensureBucket(): void {
  // mc mb is idempotent — safe to call even if bucket exists
  exec(
    `docker exec ${CONTAINER_NAME} mc alias set local http://localhost:9000 ${ACCESS_KEY} ${SECRET_KEY} 2>/dev/null`,
  );
  exec(`docker exec ${CONTAINER_NAME} mc mb local/${TEST_BUCKET} 2>/dev/null`);
}

export type MinioTestContext =
  | { readonly available: true; readonly config: S3AdapterConfig; cleanup: () => Promise<void> }
  | { readonly available: false; readonly config: null; cleanup: () => Promise<void> };

/**
 * Ensures a MinIO instance is available for testing.
 *
 * 1. Checks if MinIO is already running on localhost:9000
 * 2. If not, starts a Docker container
 * 3. Creates the test bucket
 * 4. Returns config + cleanup function
 */
export async function ensureMinio(): Promise<MinioTestContext> {
  const unavailable: MinioTestContext = {
    available: false,
    config: null,
    cleanup: async () => {},
  };

  // Try to connect to existing MinIO
  try {
    const response = await fetch(`http://localhost:${String(MINIO_PORT)}/minio/health/live`);
    if (response.ok) {
      ensureBucket();
      return makeContext();
    }
  } catch {
    // Not running, try Docker
  }

  // Try starting via Docker
  const hasDocker = exec("docker --version").length > 0;
  if (!hasDocker) return unavailable;

  if (!isContainerRunning()) {
    const started = startContainer();
    if (!started) return unavailable;
  }

  const ready = await waitForReady();
  if (!ready) return unavailable;

  ensureBucket();
  return makeContext();
}

function makeContext(): MinioTestContext {
  return {
    available: true,
    config: {
      bucket: TEST_BUCKET,
      region: "us-east-1",
      endpoint: `http://localhost:${String(MINIO_PORT)}`,
      credentials: {
        accessKeyId: ACCESS_KEY,
        secretAccessKey: SECRET_KEY,
      },
    },
    /** Removes all objects from the test bucket. Does not stop or remove the container. */
    cleanup: () => {
      exec(
        `docker exec ${CONTAINER_NAME} mc rm --recursive --force local/${TEST_BUCKET}/ 2>/dev/null`,
      );
      return Promise.resolve();
    },
  };
}
