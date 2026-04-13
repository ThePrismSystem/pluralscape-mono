/**
 * E2E global setup factory.
 *
 * Returns a vitest globalSetup function that provisions Docker containers
 * (Postgres, MinIO), applies migrations, and spawns the API server.
 *
 * Console logging happens only in the returned function, which consumers
 * export from their own `global-setup.ts` (eslint-exempt for no-console).
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

import { spawnApiServer } from "./api-server.js";
import {
  DOCKER_CONTAINER_NAME,
  MINIO_CONTAINER_NAME,
  dockerIsAvailable,
  ensureMinioBucket,
  ensureMinioContainer,
  startPostgresContainer,
  waitForMinio,
  waitForPostgres,
} from "./docker.js";

import type { SpawnedServer } from "./api-server.js";

export interface E2EGlobalSetupOptions {
  /** Log function for informational messages. */
  readonly log: (msg: string) => void;
  /** Log function for warning messages. */
  readonly warn: (msg: string) => void;
}

/**
 * Create a vitest globalSetup function that boots the full E2E environment.
 *
 * The caller (a `global-setup.ts` file, which is eslint-exempt for
 * no-console) provides log functions that wrap `console.info`/`console.warn`.
 */
export function createE2EGlobalSetup(options: E2EGlobalSetupOptions): () => Promise<() => void> {
  const { log, warn } = options;
  return async function globalSetup(): Promise<() => void> {
    let databaseUrl = process.env["E2E_DATABASE_URL"];
    let startedContainer = false;

    if (!databaseUrl) {
      if (!dockerIsAvailable()) {
        throw new Error(
          "E2E tests require either E2E_DATABASE_URL or Docker.\n" +
            "  Local: install Docker and it will be started automatically.\n" +
            "  CI: set E2E_DATABASE_URL to a PostgreSQL connection string.",
        );
      }

      log("Starting Postgres container...");
      databaseUrl = startPostgresContainer();
      startedContainer = true;

      log("Waiting for Postgres to be ready...");
      waitForPostgres(databaseUrl);
      log("Postgres is ready.");
    }

    let startedMinio = false;
    if (dockerIsAvailable()) {
      log("Ensuring MinIO container is available...");
      startedMinio = ensureMinioContainer();

      log("Waiting for MinIO to be ready...");
      await waitForMinio();

      log("Ensuring MinIO bucket exists...");
      ensureMinioBucket();
      log("MinIO is ready.");
    } else {
      warn("Docker not available for MinIO. Blob-related tests may fail.");
    }

    process.env["E2E_STARTED_CONTAINER"] = startedContainer ? "1" : "";
    process.env["E2E_STARTED_MINIO"] = startedMinio ? "1" : "";

    const monorepoRoot = findMonorepoRoot();

    let server: SpawnedServer;
    try {
      server = await spawnApiServer({ databaseUrl, monorepoRoot, log });
    } catch (err) {
      // Clean up containers if server spawn fails
      if (startedContainer) {
        try {
          execSync(`docker rm -f ${DOCKER_CONTAINER_NAME}`, { stdio: "pipe" });
        } catch {
          // ignore
        }
      }
      throw err;
    }

    process.env["E2E_SERVER_PID"] = String(server.pid);

    return () => {
      if (server.process.pid) {
        try {
          process.kill(server.process.pid, "SIGTERM");
        } catch {
          // Process may have already exited
        }
      }

      if (startedContainer) {
        log("Stopping Postgres container...");
        try {
          execSync(`docker rm -f ${DOCKER_CONTAINER_NAME}`, { stdio: "pipe" });
        } catch {
          // Container may have already been removed
        }
      }

      if (startedMinio) {
        log("Stopping MinIO container...");
        try {
          execSync(`docker rm -f ${MINIO_CONTAINER_NAME}`, { stdio: "pipe" });
        } catch {
          // Container may have already been removed
        }
      }
    };
  };
}

/**
 * Find the monorepo root by walking up from the current working directory.
 * Looks for pnpm-workspace.yaml as the marker file.
 */
function findMonorepoRoot(): string {
  let dir = process.cwd();
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("Could not find monorepo root (pnpm-workspace.yaml)");
}
