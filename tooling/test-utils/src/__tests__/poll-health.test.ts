import { spawn } from "node:child_process";
import http from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { pollHealth } from "../e2e/api-server.js";

function startDummyHealthServer(): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.url === "/health") {
        res.writeHead(200);
        res.end("ok");
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr === null || typeof addr === "string") {
        reject(new Error("unexpected address shape"));
        return;
      }
      resolve({
        port: addr.port,
        close: () =>
          new Promise<void>((resolve2, reject2) => {
            server.close((err) => {
              if (err) reject2(err);
              else resolve2();
            });
          }),
      });
    });
  });
}

describe("pollHealth", () => {
  const cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    while (cleanups.length > 0) {
      const c = cleanups.pop();
      if (c) await c();
    }
  });

  it("resolves when /health returns 200 within the timeout", async () => {
    const { port, close } = await startDummyHealthServer();
    cleanups.push(close);
    await expect(
      pollHealth({ baseUrl: `http://127.0.0.1:${String(port)}`, timeoutMs: 2000 }),
    ).resolves.toBeUndefined();
  });

  it("throws the classic timeout error when nothing answers and no child is provided", async () => {
    // Port 1 is reserved/unbindable on most systems; fetch fails fast.
    await expect(pollHealth({ baseUrl: "http://127.0.0.1:1", timeoutMs: 200 })).rejects.toThrow(
      /did not become healthy within 200ms/,
    );
  });

  it("throws with exit code and stderr tail when the child exits early", async () => {
    const child = spawn(process.execPath, [
      "-e",
      'process.stderr.write("boom\\n"); process.exit(42);',
    ]);
    const stderrTail: string[] = [];
    child.stderr.on("data", (d: Buffer) => {
      stderrTail.push(d.toString());
    });
    cleanups.push(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
      return Promise.resolve();
    });

    // Wait for the child to fully exit and for stderr to drain BEFORE
    // calling pollHealth, so detection is deterministic (seeded via
    // child.exitCode rather than a race against the 'exit' event).
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null) resolve();
      else
        child.once("exit", () => {
          resolve();
        });
    });
    // Give the stderr 'data' handler a tick to flush.
    await new Promise((r) => setTimeout(r, 10));

    const err = await pollHealth({
      baseUrl: "http://127.0.0.1:1",
      timeoutMs: 5000,
      child,
      stderrTail,
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(Error);
    const msg = (err as Error).message;
    expect(msg).toMatch(/exited before becoming healthy/);
    expect(msg).toContain("code=42");
    expect(msg).toContain("boom");
  });
});
