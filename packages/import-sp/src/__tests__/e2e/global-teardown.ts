/**
 * Vitest global teardown for import-sp E2E tests.
 *
 * Kills the API server and removes Docker containers started by global-setup.
 */
import { execSync } from "node:child_process";

const DOCKER_CONTAINER_NAME = "pluralscape-e2e-pg";
const MINIO_CONTAINER_NAME = "pluralscape-minio-test";

function globalTeardown(): void {
  const pid = process.env["E2E_SERVER_PID"];
  if (pid) {
    try {
      process.kill(Number(pid), "SIGTERM");
    } catch {
      // Process may have already exited
    }
  }

  if (process.env["E2E_STARTED_CONTAINER"] === "1") {
    console.info("[import-sp-e2e] Stopping Postgres container...");
    try {
      execSync(`docker rm -f ${DOCKER_CONTAINER_NAME}`, { stdio: "pipe" });
    } catch {
      // Container may have already been removed
    }
  }

  if (process.env["E2E_STARTED_MINIO"] === "1") {
    console.info("[import-sp-e2e] Stopping MinIO container...");
    try {
      execSync(`docker rm -f ${MINIO_CONTAINER_NAME}`, { stdio: "pipe" });
    } catch {
      // Container may have already been removed
    }
  }
}

export default globalTeardown;
