/**
 * Manages a Valkey Docker container for integration tests.
 *
 * Usage (in test setup):
 *   const { available, cleanup } = await ensureValkey();
 *   if (!available) return; // skip tests
 *   afterAll(() => cleanup());
 *
 * The container is named `pluralscape-valkey-test` and reused across runs.
 * Data is flushed between test suites, not the container itself.
 */
import { execSync } from "node:child_process";

import IORedis from "ioredis";

const CONTAINER_NAME = "pluralscape-valkey-test";
const VALKEY_PORT = Number(process.env["TEST_VALKEY_PORT"]) || 10_944;
const CONNECT_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS = 200;

function exec(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[valkey-container] exec failed: ${msg}\n`);
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
    `docker run -d --name ${CONTAINER_NAME} -p ${String(VALKEY_PORT)}:6379 valkey/valkey:8-alpine`,
  );
  return result.length > 0;
}

async function waitForReady(redis: IORedis): Promise<boolean> {
  const deadline = Date.now() + CONNECT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      await redis.ping();
      return true;
    } catch {
      // Not ready yet
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, POLL_INTERVAL_MS);
    });
  }
  return false;
}

export interface ValkeyTestContext {
  /** Whether Valkey is available for testing. */
  available: boolean;
  /** ioredis connection (null if unavailable). */
  redis: IORedis | null;
  /** Call in afterAll to disconnect (does NOT stop the container). */
  cleanup: () => Promise<void>;
}

/**
 * Ensures a Valkey instance is available for testing.
 *
 * 1. Tries to connect to localhost:6379
 * 2. If unavailable, starts a Docker container
 * 3. Returns connection + cleanup function
 */
export async function ensureValkey(): Promise<ValkeyTestContext> {
  const redis = new IORedis({
    host: "localhost",
    port: VALKEY_PORT,
    maxRetriesPerRequest: null,
    retryStrategy: () => null, // Don't retry on initial connect
    lazyConnect: true,
  });

  // Try direct connect first
  try {
    await redis.connect();
    await redis.ping();
    return {
      available: true,
      redis,
      cleanup: async () => {
        await redis.quit();
      },
    };
  } catch {
    // Direct connect failed, try Docker
  }

  // Try starting via Docker
  const hasDocker = exec("docker --version").length > 0;
  if (!hasDocker) {
    await redis.quit().catch(() => {});
    return { available: false, redis: null, cleanup: async () => {} };
  }

  if (!isContainerRunning()) {
    const started = startContainer();
    if (!started) {
      await redis.quit().catch(() => {});
      return { available: false, redis: null, cleanup: async () => {} };
    }
  }

  // Reconnect — retryStrategy: null prevents ioredis from attempting reconnects
  // after close(), which would otherwise produce unhandled rejections when BullMQ
  // duplicates this connection and then tears it down.
  const redis2 = new IORedis({
    host: "localhost",
    port: VALKEY_PORT,
    maxRetriesPerRequest: null,
    retryStrategy: () => null,
  });

  const ready = await waitForReady(redis2);
  await redis.quit().catch(() => {});

  if (!ready) {
    await redis2.quit().catch(() => {});
    return { available: false, redis: null, cleanup: async () => {} };
  }

  return {
    available: true,
    redis: redis2,
    cleanup: async () => {
      await redis2.quit();
    },
  };
}
