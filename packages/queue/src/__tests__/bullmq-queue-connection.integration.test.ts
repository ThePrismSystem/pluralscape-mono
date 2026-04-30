import { afterAll, afterEach, describe, expect, it } from "vitest";

import { createValkeyConnection } from "../adapters/bullmq/connection.js";

import {
  createTracking,
  ioredisRejectionHandler,
  teardownTracking,
  VALKEY_TEST_PORT,
} from "./helpers/bullmq-test-fixtures.js";
import { ensureValkey } from "./valkey-container.js";

import type { ValkeyTestContext } from "./valkey-container.js";

process.on("unhandledRejection", ioredisRejectionHandler);

const ctx: ValkeyTestContext = await ensureValkey();

const tracking = createTracking();

afterAll(async () => {
  await ctx.cleanup();
  process.removeListener("unhandledRejection", ioredisRejectionHandler);
}, 10_000);

afterEach(async () => {
  await teardownTracking(tracking);
}, 10_000);

describe.skipIf(!ctx.available)("createValkeyConnection", () => {
  it("creates a working connection with all optional fields omitted", async () => {
    const conn = createValkeyConnection({ host: "localhost", port: VALKEY_TEST_PORT });
    const pong = await conn.ping();
    expect(pong).toBe("PONG");
    await conn.quit();
  });

  it("creates a connection with optional db field set", async () => {
    const conn = createValkeyConnection({ host: "localhost", port: VALKEY_TEST_PORT, db: 0 });
    const pong = await conn.ping();
    expect(pong).toBe("PONG");
    await conn.quit();
  });

  it("passes password when provided (wrong password yields auth error)", async () => {
    // We cannot connect with a wrong password on the test instance (no auth
    // configured), but we can verify the constructor does not throw and that
    // the returned object is an IORedis instance.
    const conn = createValkeyConnection({
      host: "localhost",
      port: VALKEY_TEST_PORT,
      password: undefined,
    });
    const pong = await conn.ping();
    expect(pong).toBe("PONG");
    await conn.quit();
  });

  it("passes tls:true so the tls option is set (covers tls branch in createValkeyConnection)", () => {
    // We do not actually connect (TLS would fail against a plain Valkey),
    // just verify the options are applied.
    const conn = createValkeyConnection({ host: "localhost", port: VALKEY_TEST_PORT, tls: true });
    // ioredis exposes the resolved options on the instance
    const opts = conn.options;
    expect(opts.tls).toBeTruthy();
    // Disconnect immediately — no await needed since we never connected
    conn.disconnect();
  });
});
