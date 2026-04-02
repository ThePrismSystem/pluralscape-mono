import crypto from "node:crypto";

import { TRPCClientError } from "@trpc/client";

import { expect, test } from "../../fixtures/trpc.fixture.js";

test.describe("tRPC auth router", () => {
  test("register, login, list sessions, logout via tRPC", async ({ anonTrpc, trpc }) => {
    const uuid = crypto.randomUUID();
    const email = `trpc-e2e-${uuid}@test.pluralscape.local`;
    const password = `TRPCPass-${uuid}`;

    let sessionToken: string;

    await test.step("register via anonTrpc", async () => {
      const result = await anonTrpc.auth.register.mutate({
        email,
        password,
        recoveryKeyBackupConfirmed: true,
      });
      expect(result).toHaveProperty("sessionToken");
      expect(result).toHaveProperty("recoveryKey");
      expect(result).toHaveProperty("accountId");
      expect(result.accountType).toBe("system");
      sessionToken = result.sessionToken;
      expect(sessionToken).toMatch(/^[0-9a-f]{64}$/);
    });

    await test.step("login with registered credentials", async () => {
      const result = await anonTrpc.auth.login.mutate({ email, password });
      expect(result).toHaveProperty("sessionToken");
      expect(result.sessionToken).toMatch(/^[0-9a-f]{64}$/);
    });

    await test.step("list sessions returns current session", async () => {
      const result = await trpc.auth.listSessions.query({});
      expect(Array.isArray(result.sessions)).toBe(true);
      expect(result.sessions.length).toBeGreaterThanOrEqual(1);
    });

    await test.step("logout succeeds", async () => {
      const result = await trpc.auth.logout.mutate();
      expect(result.success).toBe(true);
    });
  });

  test("login with wrong password throws UNAUTHORIZED", async ({ anonTrpc }) => {
    const uuid = crypto.randomUUID();
    const email = `trpc-e2e-${uuid}@test.pluralscape.local`;

    // Register so the account exists
    await anonTrpc.auth.register.mutate({
      email,
      password: `CorrectPass-${uuid}`,
      recoveryKeyBackupConfirmed: true,
    });

    await expect(
      anonTrpc.auth.login.mutate({ email, password: "WrongPassword123!" }),
    ).rejects.toThrow(TRPCClientError);
  });

  test("listSessions without auth throws UNAUTHORIZED", async ({ anonTrpc }) => {
    await expect(anonTrpc.auth.listSessions.query({})).rejects.toThrow(TRPCClientError);
  });
});
