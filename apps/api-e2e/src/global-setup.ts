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

const E2E_PORT = 10_099;
const HEALTH_POLL_MS = 100;
const HEALTH_TIMEOUT_MS = 15_000;
const PG_READY_POLL_MS = 200;
const PG_READY_TIMEOUT_MS = 30_000;
const MS_PER_SECOND = 1000;
const DOCKER_CONTAINER_NAME = "pluralscape-e2e-pg";
const DOCKER_PG_PORT = 15_432;
const MONOREPO_ROOT = path.resolve(import.meta.dirname, "../../../");
const API_DIR = path.join(MONOREPO_ROOT, "apps/api");

/** Stable 64-char hex pepper for local E2E tests (not used in production). */
const DEFAULT_TEST_PEPPER = crypto.createHash("sha256").update("e2e-test-pepper").digest("hex");

let serverProcess: ChildProcess | null = null;

async function pollHealth(baseUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_MS));
  }
  throw new Error(`API server did not become healthy within ${String(timeoutMs)}ms`);
}

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

  // Store for teardown
  process.env["E2E_STARTED_CONTAINER"] = startedContainer ? "1" : "";

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

  // Spawn the API server
  console.info("[e2e] Starting API server on port", E2E_PORT);
  serverProcess = spawn("bun", ["run", "src/index.ts"], {
    cwd: API_DIR,
    env: {
      ...process.env,
      API_PORT: String(E2E_PORT),
      DB_DIALECT: "pg",
      DATABASE_URL: databaseUrl,
      EMAIL_HASH_PEPPER: emailPepper,
      NODE_ENV: "test",
      DISABLE_RATE_LIMIT: "1",
      BLOB_STORAGE_PATH: "/tmp/e2e-blobs",
    },
    stdio: "pipe",
  });

  serverProcess.stderr?.on("data", (data: Buffer) => {
    const msg = data.toString();
    // Surface errors and fatals, not routine pino JSON logs
    if (msg.includes('"level":50') || msg.includes('"level":60')) {
      process.stderr.write(`[api-e2e] ${msg}`);
    }
  });

  if (!serverProcess.pid) {
    throw new Error("Failed to spawn API server — pid is undefined");
  }
  process.env["E2E_SERVER_PID"] = String(serverProcess.pid);

  await pollHealth(`http://localhost:${String(E2E_PORT)}`, HEALTH_TIMEOUT_MS);
  console.info("[e2e] API server is healthy. Running tests...");
}

export default globalSetup;
