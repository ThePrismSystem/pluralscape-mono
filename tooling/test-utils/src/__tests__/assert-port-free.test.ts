import net from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { assertPortFree } from "../e2e/assert-port-free.js";

function listenEphemeral(): Promise<{ server: net.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr === null || typeof addr === "string") {
        reject(new Error("unexpected address shape"));
        return;
      }
      // addr is now narrowed to net.AddressInfo
      resolve({ server, port: addr.port });
    });
  });
}

function closeServer(server: net.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

describe("assertPortFree", () => {
  const cleanup: net.Server[] = [];
  afterEach(async () => {
    while (cleanup.length > 0) {
      const s = cleanup.pop();
      if (s?.listening) {
        await closeServer(s);
      }
    }
  });

  it("resolves when the port is free", async () => {
    // Bind-then-release to obtain a port we know is usable, then assert.
    const { server, port } = await listenEphemeral();
    await closeServer(server);
    await expect(assertPortFree(port)).resolves.toBeUndefined();
  });

  it("rejects with an actionable message when the port is in use", async () => {
    const { server, port } = await listenEphemeral();
    cleanup.push(server);
    await expect(assertPortFree(port)).rejects.toThrow(/already in use/);
    await expect(assertPortFree(port)).rejects.toThrow(`lsof -iTCP:${String(port)}`);
  });

  it("does not leak the probe port after a successful call", async () => {
    const { server, port } = await listenEphemeral();
    await closeServer(server);
    await assertPortFree(port);
    // Port must still be bindable afterwards — proves the probe closed.
    const reuse = net.createServer();
    await new Promise<void>((resolve, reject) => {
      reuse.once("error", reject);
      reuse.listen(port, "127.0.0.1", () => {
        resolve();
      });
    });
    cleanup.push(reuse);
  });
});
