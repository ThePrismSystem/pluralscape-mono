/**
 * Playwright global teardown: kill the API server and stop the Docker container.
 */
import { execSync } from "node:child_process";

import { stopE2ECrowdinStub } from "./crowdin-stub-lifecycle.js";

const DOCKER_CONTAINER_NAME = "pluralscape-e2e-pg";
const MINIO_CONTAINER_NAME = "pluralscape-minio-test";

async function globalTeardown(): Promise<void> {
  // Kill the API server
  const pid = process.env["E2E_SERVER_PID"];
  if (pid) {
    try {
      process.kill(Number(pid), "SIGTERM");
    } catch {
      // Process may have already exited
    }
  }

  // Close the local Crowdin OTA stub. Playwright loads both globalSetup and
  // globalTeardown in the same Node process, so the module-level holder in
  // `crowdin-stub-lifecycle.ts` still references the live server here.
  try {
    await stopE2ECrowdinStub();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[e2e] Crowdin stub shutdown failed", message);
  }

  // Stop and remove the Docker containers if we started them
  if (process.env["E2E_STARTED_CONTAINER"] === "1") {
    console.info("[e2e] Stopping Postgres container...");
    try {
      execSync(`docker rm -f ${DOCKER_CONTAINER_NAME}`, { stdio: "pipe" });
    } catch {
      // Container may have already been removed
    }
  }

  if (process.env["E2E_STARTED_MINIO"] === "1") {
    console.info("[e2e] Stopping MinIO container...");
    try {
      execSync(`docker rm -f ${MINIO_CONTAINER_NAME}`, { stdio: "pipe" });
    } catch {
      // Container may have already been removed
    }
  }
}

export default globalTeardown;
