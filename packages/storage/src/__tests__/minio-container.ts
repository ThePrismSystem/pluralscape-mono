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
const MINIO_PORT = 9000;
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

async function ensureBucket(): Promise<void> {
  // Use the S3 API to create the test bucket via MinIO's S3-compatible endpoint
  const endpoint = `http://localhost:${String(MINIO_PORT)}`;
  try {
    // Try a lightweight HEAD first
    const headResponse = await fetch(`${endpoint}/${TEST_BUCKET}`, { method: "HEAD" });
    if (headResponse.ok) return;
  } catch {
    // Bucket doesn't exist, create it
  }

  // Use mc CLI from docker exec to create bucket
  exec(
    `docker exec ${CONTAINER_NAME} mc alias set local http://localhost:9000 ${ACCESS_KEY} ${SECRET_KEY} 2>/dev/null`,
  );
  exec(`docker exec ${CONTAINER_NAME} mc mb local/${TEST_BUCKET} 2>/dev/null`);
}

export interface MinioTestContext {
  /** Whether MinIO is available for testing. */
  available: boolean;
  /** S3 adapter config for MinIO. Null if unavailable. */
  config: S3AdapterConfig | null;
  /** Call in afterAll to clean up. Does NOT stop the container. */
  cleanup: () => Promise<void>;
}

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
      await ensureBucket();
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

  await ensureBucket();
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
    cleanup: () => {
      // Clean bucket contents between test suites
      exec(
        `docker exec ${CONTAINER_NAME} mc rm --recursive --force local/${TEST_BUCKET}/ 2>/dev/null`,
      );
      return Promise.resolve();
    },
  };
}
