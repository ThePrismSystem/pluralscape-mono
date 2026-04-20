/**
 * Playwright global setup: provision a database, migrate it, and spawn the API server.
 *
 * If E2E_DATABASE_URL is set (CI), uses that database directly.
 * Otherwise, spins up a temporary Docker Postgres container for local dev.
 *
 * EMAIL_HASH_PEPPER defaults to a stable test value if not set.
 */
import { execFileSync, execSync, spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";

import { inheritEnvWithoutVitest } from "@pluralscape/test-utils/e2e/api-env";
import { E2E_PORT, pollHealth } from "@pluralscape/test-utils/e2e/api-server";
import { assertPortFree } from "@pluralscape/test-utils/e2e/assert-port-free";
import { createStderrClassifier } from "@pluralscape/test-utils/e2e/classify-pino-stderr";
import { MS_PER_SECOND } from "@pluralscape/types";

import {
  E2E_CROWDIN_HASH,
  startE2ECrowdinStub,
  stopE2ECrowdinStub,
} from "./crowdin-stub-lifecycle.js";

const HEALTH_TIMEOUT_MS = 15_000;
const STDERR_TAIL_MAX_LINES = 200;
const PG_READY_POLL_MS = 200;
const PG_READY_TIMEOUT_MS = 30_000;
const DOCKER_CONTAINER_NAME = "pluralscape-e2e-pg";
const DOCKER_PG_PORT = 15_432;
const MINIO_CONTAINER_NAME = "pluralscape-minio-test";
/** Default MinIO port matching TEST_MINIO_PORT in .env.example. */
const DEFAULT_MINIO_PORT = 10_943;
const envMinioPort = process.env["TEST_MINIO_PORT"];
const MINIO_PORT =
  envMinioPort !== undefined && envMinioPort !== "" ? Number(envMinioPort) : DEFAULT_MINIO_PORT;
const MINIO_READY_POLL_MS = 200;
const MINIO_READY_TIMEOUT_MS = 30_000;
const MINIO_BUCKET = "pluralscape-test";
const MINIO_ROOT_USER = "minioadmin";
const MINIO_ROOT_PASSWORD = "minioadmin";
const MONOREPO_ROOT = path.resolve(import.meta.dirname, "../../../");
const API_DIR = path.join(MONOREPO_ROOT, "apps/api");

/** Stable 64-char hex keys for local E2E tests (not used in production). */
const DEFAULT_TEST_PEPPER = crypto.createHash("sha256").update("e2e-test-pepper").digest("hex");
const DEFAULT_TEST_WEBHOOK_KEY = crypto
  .createHash("sha256")
  .update("e2e-test-webhook-key")
  .digest("hex");

let serverProcess: ChildProcess | null = null;

function dockerIsAvailable(): boolean {
  try {
    execSync("docker info", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function startPostgresContainer(): string {
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

function waitForPostgres(databaseUrl: string): void {
  const deadline = Date.now() + PG_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      execSync(`docker exec ${DOCKER_CONTAINER_NAME} pg_isready -U postgres`, { stdio: "pipe" });
      // Also verify we can connect via the URL
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

function ensureMinioContainer(): boolean {
  // Check if the shared MinIO container is already running
  try {
    const status = execSync(
      `docker ps --filter name=${MINIO_CONTAINER_NAME} --format "{{.Status}}"`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
    if (status.startsWith("Up")) return false; // already running, we didn't start it
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
      return false; // restarted existing, don't tear down
    }
  } catch {
    // No existing container
  }

  // Create new container
  execSync(
    [
      "docker run -d",
      `--name ${MINIO_CONTAINER_NAME}`,
      `-p ${String(MINIO_PORT)}:9000`,
      `-e MINIO_ROOT_USER=${MINIO_ROOT_USER}`,
      `-e MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}`,
      "minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e server /data",
    ].join(" "),
    { stdio: "pipe" },
  );
  return true; // we created it, teardown should clean up
}

async function waitForMinio(): Promise<void> {
  const deadline = Date.now() + MINIO_READY_TIMEOUT_MS;
  const url = `http://localhost:${String(MINIO_PORT)}/minio/health/live`;
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

function ensureMinioBucket(): void {
  // Alias setup MUST succeed — propagate errors so misconfiguration is visible
  execSync(
    `docker exec ${MINIO_CONTAINER_NAME} mc alias set local http://localhost:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD}`,
    { stdio: "pipe" },
  );
  // Bucket creation is idempotent — mc mb exits non-zero if bucket already exists
  try {
    execSync(`docker exec ${MINIO_CONTAINER_NAME} mc mb local/${MINIO_BUCKET}`, {
      stdio: "pipe",
    });
  } catch {
    // Bucket already exists — expected on reused containers
  }
}

async function globalSetup(): Promise<void> {
  let databaseUrl = process.env["E2E_DATABASE_URL"];
  let startedContainer = false;

  // If no database URL provided, spin up a Docker container
  if (!databaseUrl) {
    if (!dockerIsAvailable()) {
      throw new Error(
        "E2E tests require either E2E_DATABASE_URL or Docker.\n" +
          "  Local: install Docker and it will be started automatically.\n" +
          "  CI: set E2E_DATABASE_URL to a PostgreSQL connection string.",
      );
    }

    console.info("[e2e] Starting Postgres container...");
    databaseUrl = startPostgresContainer();
    startedContainer = true;

    console.info("[e2e] Waiting for Postgres to be ready...");
    waitForPostgres(databaseUrl);
    console.info("[e2e] Postgres is ready.");
  }

  // Ensure MinIO is available for blob storage (reuses existing container if running)
  let startedMinio = false;
  if (dockerIsAvailable()) {
    console.info("[e2e] Ensuring MinIO container is available...");
    startedMinio = ensureMinioContainer();

    console.info("[e2e] Waiting for MinIO to be ready...");
    await waitForMinio();

    console.info("[e2e] Ensuring MinIO bucket exists...");
    ensureMinioBucket();
    console.info("[e2e] MinIO is ready.");
  } else {
    console.warn(
      "[e2e] Docker not available — MinIO setup skipped. Blob-related E2E tests may fail.",
    );
  }

  // Store for teardown
  process.env["E2E_STARTED_CONTAINER"] = startedContainer ? "1" : "";
  process.env["E2E_STARTED_MINIO"] = startedMinio ? "1" : "";

  // Expose the resolved database URL to tests so specs that need to probe
  // Postgres directly (e.g. concurrency/lock-contention.spec.ts) can connect
  // to the same DB the API under test uses.
  process.env["E2E_DATABASE_URL"] = databaseUrl;

  const emailPepper = process.env["EMAIL_HASH_PEPPER"] ?? DEFAULT_TEST_PEPPER;

  // Push schema to the E2E database
  // Apply migrations using Drizzle's migrator (handles parameterized CHECK constraint SQL)
  console.info("[e2e] Applying migrations...");
  const migrateScript = path.join(MONOREPO_ROOT, "apps/api-e2e/src/migrate.ts");
  try {
    execFileSync("bun", [migrateScript, databaseUrl], {
      cwd: MONOREPO_ROOT,
      env: process.env,
      stdio: "pipe",
    });
  } catch (err) {
    const execErr = err as { stderr?: Buffer; stdout?: Buffer };
    const stderr = execErr.stderr?.toString() ?? "";
    const stdout = execErr.stdout?.toString() ?? "";
    throw new Error(`Migration failed:\nstdout: ${stdout}\nstderr: ${stderr}`);
  }

  // Start the local Crowdin OTA stub BEFORE spawning the API so the API's
  // memoized deps pick up the stub's baseUrl at first-request time. The stub
  // binds to 127.0.0.1:0 and exposes its URL via `.baseUrl`.
  console.info("[e2e] Starting local Crowdin OTA stub...");
  const crowdinStub = await startE2ECrowdinStub();
  console.info("[e2e] Crowdin stub listening on", crowdinStub.baseUrl);

  // Playwright does NOT invoke globalTeardown when globalSetup throws, so any
  // failure after this point would leak the stub's listening socket. Wrap the
  // remaining setup (API spawn + health poll) and tear the stub down on error
  // before re-throwing so the socket is released even on aborted setups.
  try {
    // Spawn the API server
    await assertPortFree(E2E_PORT);
    console.info("[e2e] Starting API server on port", E2E_PORT);
    const spawnEnv: NodeJS.ProcessEnv = {
      ...inheritEnvWithoutVitest(),
      API_PORT: String(E2E_PORT),
      DB_DIALECT: "pg",
      DATABASE_URL: databaseUrl,
      EMAIL_HASH_PEPPER: emailPepper,
      WEBHOOK_PAYLOAD_ENCRYPTION_KEY:
        process.env["WEBHOOK_PAYLOAD_ENCRYPTION_KEY"] ?? DEFAULT_TEST_WEBHOOK_KEY,
      NODE_ENV: "test",
      DISABLE_RATE_LIMIT: "1",
      BLOB_STORAGE_S3_BUCKET: MINIO_BUCKET,
      BLOB_STORAGE_S3_ENDPOINT: `http://localhost:${String(MINIO_PORT)}`,
      BLOB_STORAGE_S3_FORCE_PATH_STYLE: "1",
      AWS_ACCESS_KEY_ID: MINIO_ROOT_USER,
      AWS_SECRET_ACCESS_KEY: MINIO_ROOT_PASSWORD,
      // Wire the i18n proxy to the local stub so the suite exercises the
      // full Crowdin contract against a controllable fixture.
      CROWDIN_DISTRIBUTION_HASH: E2E_CROWDIN_HASH,
      CROWDIN_OTA_BASE_URL: crowdinStub.baseUrl,
    };
    serverProcess = spawn("bun", ["run", "src/index.ts"], {
      cwd: API_DIR,
      env: spawnEnv,
      stdio: "pipe",
    });

    const stderrTail: string[] = [];
    const classifier = createStderrClassifier({ prefix: "[api-e2e] " });
    serverProcess.stderr?.on("data", (data: Buffer) => {
      const { forwarded, tailLines } = classifier.process(data.toString());
      if (forwarded !== "") process.stderr.write(forwarded);
      for (const line of tailLines) {
        stderrTail.push(line);
        if (stderrTail.length > STDERR_TAIL_MAX_LINES) stderrTail.shift();
      }
    });
    serverProcess.stderr?.on("end", () => {
      const { forwarded, tailLines } = classifier.flush();
      if (forwarded !== "") process.stderr.write(forwarded);
      for (const line of tailLines) {
        stderrTail.push(line);
        if (stderrTail.length > STDERR_TAIL_MAX_LINES) stderrTail.shift();
      }
    });

    if (!serverProcess.pid) {
      throw new Error("Failed to spawn API server — pid is undefined");
    }
    process.env["E2E_SERVER_PID"] = String(serverProcess.pid);

    await pollHealth({
      baseUrl: `http://localhost:${String(E2E_PORT)}`,
      timeoutMs: HEALTH_TIMEOUT_MS,
      child: serverProcess,
      stderrTail,
    });
    console.info("[e2e] API server is healthy. Running tests...");
  } catch (err: unknown) {
    // Setup aborted — close the stub we already started so it doesn't leak.
    // globalTeardown is not invoked by Playwright when globalSetup throws.
    await stopE2ECrowdinStub();
    throw err;
  }
}

export default globalSetup;
