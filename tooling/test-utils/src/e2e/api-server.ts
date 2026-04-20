/**
 * API server process management for E2E tests.
 *
 * Spawns the Pluralscape API server against a test database and polls
 * until the health endpoint responds.
 */
import { execFileSync, execSync, spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";

import { assertPortFree } from "./assert-port-free.js";
import {
  DOCKER_CONTAINER_NAME,
  MINIO_BUCKET,
  MINIO_CONTAINER_NAME,
  getMinioPort,
} from "./docker.js";

const HEALTH_POLL_MS = 100;
const HEALTH_TIMEOUT_MS = 15_000;

/** Stable 64-char hex pepper for local E2E tests (not used in production). */
const DEFAULT_TEST_PEPPER = crypto.createHash("sha256").update("e2e-test-pepper").digest("hex");

export const E2E_PORT = 10_099;
export const API_BASE_URL = `http://localhost:${String(E2E_PORT)}`;

export interface PollHealthOptions {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  /**
   * Optional spawned child to monitor. If the child exits before /health
   * becomes healthy, the promise rejects immediately with the exit code
   * and the most recent stderr chunks.
   */
  readonly child?: ChildProcess;
  /**
   * Bounded ring of recent stderr chunks captured by the caller. Used
   * verbatim in the early-exit error message.
   */
  readonly stderrTail?: readonly string[];
}

export async function pollHealth(options: PollHealthOptions): Promise<void> {
  const { baseUrl, timeoutMs, child, stderrTail } = options;
  // Seed earlyExit from exitCode/signalCode so a child that exited before
  // pollHealth was called is still detected — the 'exit' event never fires
  // retroactively, so the listener alone is insufficient.
  let earlyExit: { code: number | null; signal: NodeJS.Signals | null } | null =
    child && child.exitCode !== null ? { code: child.exitCode, signal: child.signalCode } : null;
  const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
    earlyExit = { code, signal };
  };
  child?.on("exit", onExit);
  try {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (earlyExit !== null) {
        const tail = (stderrTail ?? []).join("");
        throw new Error(
          `API server exited before becoming healthy (code=${String(earlyExit.code)}, signal=${String(earlyExit.signal)}).\n` +
            `Recent stderr:\n${tail}`,
        );
      }
      try {
        const res = await fetch(`${baseUrl}/health`);
        if (res.ok) return;
      } catch {
        // Server not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_MS));
    }
    throw new Error(`API server did not become healthy within ${String(timeoutMs)}ms`);
  } finally {
    child?.off("exit", onExit);
  }
}

export interface SpawnedServer {
  readonly process: ChildProcess;
  readonly pid: number;
}

export interface SpawnApiServerOptions {
  readonly databaseUrl: string;
  readonly monorepoRoot: string;
  /** Log function for orchestration messages. */
  readonly log: (msg: string) => void;
}

/**
 * Apply database migrations and spawn the API server process.
 *
 * Returns the spawned server and resolves once the health endpoint is healthy.
 */
export async function spawnApiServer(options: SpawnApiServerOptions): Promise<SpawnedServer> {
  const { databaseUrl, monorepoRoot, log } = options;
  const apiDir = path.join(monorepoRoot, "apps/api");
  const emailPepper = process.env["EMAIL_HASH_PEPPER"] ?? DEFAULT_TEST_PEPPER;
  const minioPort = getMinioPort();

  log("Applying migrations...");
  const migrateScript = path.join(monorepoRoot, "apps/api-e2e/src/migrate.ts");
  try {
    execFileSync("bun", [migrateScript, databaseUrl], {
      cwd: monorepoRoot,
      env: process.env,
      stdio: "pipe",
    });
  } catch (err) {
    const execErr = err as { stderr?: Buffer; stdout?: Buffer };
    const stderr = execErr.stderr?.toString() ?? "";
    const stdout = execErr.stdout?.toString() ?? "";
    throw new Error(`Migration failed:\nstdout: ${stdout}\nstderr: ${stderr}`);
  }

  await assertPortFree(E2E_PORT);
  log(`Starting API server on port ${String(E2E_PORT)}`);
  // Strip VITEST from the inherited env — apps/api/src/index.ts gates its
  // start() call on `!process.env["VITEST"]` to avoid an async teardown race
  // when the module is `import`ed by unit tests. The spawned server is a
  // separate process that SHOULD run start(); leaking the parent's VITEST
  // flag silences start() and the health check times out.
  const spawnEnv: NodeJS.ProcessEnv = {
    ...process.env,
    API_PORT: String(E2E_PORT),
    DB_DIALECT: "pg",
    DATABASE_URL: databaseUrl,
    EMAIL_HASH_PEPPER: emailPepper,
    NODE_ENV: "test",
    DISABLE_RATE_LIMIT: "1",
    BLOB_STORAGE_S3_BUCKET: MINIO_BUCKET,
    BLOB_STORAGE_S3_ENDPOINT: `http://localhost:${String(minioPort)}`,
    BLOB_STORAGE_S3_FORCE_PATH_STYLE: "1",
    AWS_ACCESS_KEY_ID: "minioadmin",
    AWS_SECRET_ACCESS_KEY: "minioadmin",
  };
  delete spawnEnv["VITEST"];
  const serverProcess = spawn("bun", ["run", "src/index.ts"], {
    cwd: apiDir,
    env: spawnEnv,
    stdio: "pipe",
  });

  const stderrTail: string[] = [];
  const STDERR_TAIL_MAX = 20;
  serverProcess.stderr.on("data", (data: Buffer) => {
    const msg = data.toString();
    // Classify per-line. A single 'data' event can contain multiple records;
    // testing the entire chunk would misclassify raw Bun errors that happen to
    // share a chunk with a pino INFO/DEBUG/WARN line.
    const lines = msg.split(/\r?\n/);
    let forwarded = "";
    for (const line of lines) {
      if (line === "") continue;
      const isPinoJson = /^\s*\{.*"level":\d+/.test(line);
      const isLowLevelPino =
        isPinoJson && !line.includes('"level":50') && !line.includes('"level":60');
      if (!isLowLevelPino) {
        forwarded += `${line}\n`;
      }
    }
    if (forwarded !== "") {
      process.stderr.write(forwarded);
    }
    stderrTail.push(msg);
    if (stderrTail.length > STDERR_TAIL_MAX) stderrTail.shift();
  });

  if (!serverProcess.pid) {
    throw new Error("Failed to spawn API server — pid is undefined");
  }

  await pollHealth({
    baseUrl: API_BASE_URL,
    timeoutMs: HEALTH_TIMEOUT_MS,
    child: serverProcess,
    stderrTail,
  });
  log("API server is healthy. Running tests...");

  return { process: serverProcess, pid: serverProcess.pid };
}

/**
 * Kill a previously spawned API server and clean up Docker containers.
 */
export function killServer(
  pid: number | undefined,
  options: { startedPgContainer: boolean; startedMinio: boolean; log: (msg: string) => void },
): void {
  if (pid) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Process may have already exited
    }
  }

  if (options.startedPgContainer) {
    options.log("Stopping Postgres container...");
    try {
      execSync(`docker rm -f ${DOCKER_CONTAINER_NAME}`, { stdio: "pipe" });
    } catch {
      // Container may have already been removed
    }
  }

  if (options.startedMinio) {
    options.log("Stopping MinIO container...");
    try {
      execSync(`docker rm -f ${MINIO_CONTAINER_NAME}`, { stdio: "pipe" });
    } catch {
      // Container may have already been removed
    }
  }
}
