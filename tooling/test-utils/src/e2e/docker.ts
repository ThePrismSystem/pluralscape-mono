/**
 * Docker container lifecycle helpers for E2E tests.
 *
 * Manages Postgres and MinIO containers used by import E2E suites.
 */
import { execSync } from "node:child_process";

const PG_READY_POLL_MS = 200;
const PG_READY_TIMEOUT_MS = 30_000;
const MS_PER_SECOND = 1000;
const MINIO_READY_POLL_MS = 200;
const MINIO_READY_TIMEOUT_MS = 30_000;
const MINIO_ROOT_USER = "minioadmin";
const MINIO_ROOT_PASSWORD = "minioadmin";

export const DOCKER_CONTAINER_NAME = "pluralscape-e2e-pg";
export const DOCKER_PG_PORT = 15_432;
export const MINIO_CONTAINER_NAME = "pluralscape-minio-test";
export const MINIO_BUCKET = "pluralscape-test";
/** Default MinIO port matching TEST_MINIO_PORT in .env.example. */
export const DEFAULT_MINIO_PORT = 10_943;

export function getMinioPort(): number {
  const envMinioPort = process.env["TEST_MINIO_PORT"];
  return envMinioPort !== undefined && envMinioPort !== ""
    ? Number(envMinioPort)
    : DEFAULT_MINIO_PORT;
}

export function dockerIsAvailable(): boolean {
  try {
    execSync("docker info", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function startPostgresContainer(): string {
  // Remove any leftover container from a previous crashed run
  try {
    execSync(`docker rm -f ${DOCKER_CONTAINER_NAME}`, { stdio: "pipe" });
  } catch {
    // No leftover container
  }

  execSync(
    [
      "docker run -d",
      `--name ${DOCKER_CONTAINER_NAME}`,
      `-p ${String(DOCKER_PG_PORT)}:5432`,
      "-e POSTGRES_DB=pluralscape_e2e",
      "-e POSTGRES_USER=postgres",
      "-e POSTGRES_PASSWORD=postgres",
      "postgres:17-alpine",
    ].join(" "),
    { stdio: "pipe" },
  );

  return `postgres://postgres:postgres@localhost:${String(DOCKER_PG_PORT)}/pluralscape_e2e`;
}

export function waitForPostgres(databaseUrl: string): void {
  const deadline = Date.now() + PG_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      execSync(`docker exec ${DOCKER_CONTAINER_NAME} pg_isready -U postgres`, { stdio: "pipe" });
      execSync(
        `docker exec ${DOCKER_CONTAINER_NAME} psql -U postgres -d pluralscape_e2e -c "SELECT 1"`,
        { stdio: "pipe" },
      );
      return;
    } catch {
      execSync(`sleep ${String(PG_READY_POLL_MS / MS_PER_SECOND)}`, { stdio: "pipe" });
    }
  }
  throw new Error(
    `Postgres container did not become ready within ${String(PG_READY_TIMEOUT_MS)}ms (url: ${databaseUrl})`,
  );
}

export function ensureMinioContainer(): boolean {
  const minioPort = getMinioPort();

  // Check if the shared MinIO container is already running
  try {
    const status = execSync(
      `docker ps --filter name=${MINIO_CONTAINER_NAME} --format "{{.Status}}"`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
    if (status.startsWith("Up")) return false;
  } catch {
    // Not running
  }

  // Check if container exists but is stopped
  try {
    const id = execSync(`docker ps -a --filter name=${MINIO_CONTAINER_NAME} --format "{{.ID}}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (id) {
      execSync(`docker start ${MINIO_CONTAINER_NAME}`, { stdio: "pipe" });
      return false;
    }
  } catch {
    // No existing container
  }

  // Create new container
  execSync(
    [
      "docker run -d",
      `--name ${MINIO_CONTAINER_NAME}`,
      `-p ${String(minioPort)}:9000`,
      `-e MINIO_ROOT_USER=${MINIO_ROOT_USER}`,
      `-e MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}`,
      "minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e server /data",
    ].join(" "),
    { stdio: "pipe" },
  );
  return true;
}

export async function waitForMinio(): Promise<void> {
  const minioPort = getMinioPort();
  const deadline = Date.now() + MINIO_READY_TIMEOUT_MS;
  const url = `http://localhost:${String(minioPort)}/minio/health/live`;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // MinIO not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, MINIO_READY_POLL_MS));
  }
  throw new Error(`MinIO did not become healthy within ${String(MINIO_READY_TIMEOUT_MS)}ms`);
}

export function ensureMinioBucket(): void {
  execSync(
    `docker exec ${MINIO_CONTAINER_NAME} mc alias set local http://localhost:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD}`,
    { stdio: "pipe" },
  );
  try {
    execSync(`docker exec ${MINIO_CONTAINER_NAME} mc mb local/${MINIO_BUCKET}`, {
      stdio: "pipe",
    });
  } catch {
    // Bucket already exists
  }
}
