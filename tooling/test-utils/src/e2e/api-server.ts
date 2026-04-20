/**
 * API server process management for E2E tests.
 *
 * Spawns the Pluralscape API server against a test database and polls
 * until the health endpoint responds.
 */
import { execFileSync, execSync, spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";

import { inheritEnvWithoutVitest } from "./api-env.js";
import { assertPortFree } from "./assert-port-free.js";
import { createStderrClassifier } from "./classify-pino-stderr.js";
import {
  DOCKER_CONTAINER_NAME,
  MINIO_BUCKET,
  MINIO_CONTAINER_NAME,
  getMinioPort,
} from "./docker.js";

const HEALTH_POLL_MS = 100;
const HEALTH_TIMEOUT_MS = 15_000;
const STDERR_TAIL_MAX_LINES = 200;

/** Stable 64-char hex pepper for local E2E tests (not used in production). */
const DEFAULT_TEST_PEPPER = crypto.createHash("sha256").update("e2e-test-pepper").digest("hex");

export const E2E_PORT = 10_099;
export const API_BASE_URL = `http://localhost:${String(E2E_PORT)}`;

interface PollHealthBase {
  readonly baseUrl: string;
  readonly timeoutMs: number;
}

/**
 * Options for pollHealth. A discriminated union: when `child` is provided,
 * `stderrTail` may accompany it and is used in the early-exit error
 * message; when `child` is absent, `stderrTail` must also be absent (it
 * would otherwise be silently ignored).
 */
export type PollHealthOptions =
  | (PollHealthBase & { readonly child?: undefined; readonly stderrTail?: undefined })
  | (PollHealthBase & {
      readonly child: ChildProcess;
      readonly stderrTail?: readonly string[];
    });

export async function pollHealth(options: PollHealthOptions): Promise<void> {
  const { baseUrl, timeoutMs } = options;
  const child = options.child;
  const stderrTail = options.stderrTail;
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
        const tail = (stderrTail ?? []).join("\n");
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
  const spawnEnv: NodeJS.ProcessEnv = {
    ...inheritEnvWithoutVitest(),
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
  const serverProcess = spawn("bun", ["run", "src/index.ts"], {
    cwd: apiDir,
    env: spawnEnv,
    stdio: "pipe",
  });

  const stderrTail: string[] = [];
  const classifier = createStderrClassifier();
  serverProcess.stderr.on("data", (data: Buffer) => {
    const { forwarded, tailLines } = classifier.process(data.toString());
    if (forwarded !== "") process.stderr.write(forwarded);
    for (const line of tailLines) {
      stderrTail.push(line);
      if (stderrTail.length > STDERR_TAIL_MAX_LINES) stderrTail.shift();
    }
  });
  serverProcess.stderr.on("end", () => {
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
