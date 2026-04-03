/**
 * tRPC transport edge cases.
 *
 * These tests exercise protocol-level behavior that has no REST equivalent:
 * unauthenticated access, bad input shapes, and cross-account IDOR protection.
 */
import { TRPCClientError } from "@trpc/client";

import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { expect, test } from "../../fixtures/trpc.fixture.js";

import type { AppRouter } from "@pluralscape/api/trpc";

type AppTRPCError = TRPCClientError<AppRouter>;

function asTRPCError(err: unknown): AppTRPCError | null {
  return err instanceof TRPCClientError ? (err as AppTRPCError) : null;
}

test.describe("tRPC transport edge cases", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("unauthenticated call to protected procedure returns UNAUTHORIZED", async ({ anonTrpc }) => {
    let error: AppTRPCError | null = null;
    try {
      await anonTrpc.system.list.query({});
    } catch (err) {
      error = asTRPCError(err);
    }

    expect(error).not.toBeNull();
    expect(error?.data?.code).toBe("UNAUTHORIZED");
  });

  test("invalid input to create member returns BAD_REQUEST", async ({ trpc }) => {
    const systemsResult = await trpc.system.list.query({});
    const systemId = systemsResult.data[0]?.id;
    expect(systemId).toBeTruthy();

    let error: AppTRPCError | null = null;
    try {
      // encryptedData is required but we pass an empty string (fails min(1))
      await trpc.member.create.mutate({
        systemId,
        encryptedData: "",
      });
    } catch (err) {
      error = asTRPCError(err);
    }

    expect(error).not.toBeNull();
    expect(error?.data?.code).toBe("BAD_REQUEST");
  });

  test("IDOR: accessing another account's system returns NOT_FOUND", async ({
    trpc,
    secondTrpc,
  }) => {
    // Get the second account's system ID
    const secondSystems = await secondTrpc.system.list.query({});
    const secondSystemId = secondSystems.data[0]?.id;
    expect(secondSystemId).toBeTruthy();

    // Try to access it as the first account
    let error: AppTRPCError | null = null;
    try {
      await trpc.member.list.query({ systemId: secondSystemId });
    } catch (err) {
      error = asTRPCError(err);
    }

    expect(error).not.toBeNull();
    expect(error?.data?.code).toBe("NOT_FOUND");
  });

  test("error shape includes code field", async ({ anonTrpc }) => {
    let error: AppTRPCError | null = null;
    try {
      await anonTrpc.auth.logout.mutate();
    } catch (err) {
      error = asTRPCError(err);
    }

    expect(error).not.toBeNull();
    expect(typeof error?.data?.code).toBe("string");
    expect(error?.data?.code).toBe("UNAUTHORIZED");
    expect(typeof error?.message).toBe("string");
  });

  test("create member with valid data succeeds (transport round-trip)", async ({ trpc }) => {
    const systemsResult = await trpc.system.list.query({});
    const systemId = systemsResult.data[0]?.id;
    expect(systemId).toBeTruthy();

    const result = await trpc.member.create.mutate({
      systemId,
      encryptedData: encryptForApi({ name: "Transport Test Member" }),
    });
    expect(result).toHaveProperty("id");

    // Clean up
    await trpc.member.delete.mutate({ systemId, memberId: result.id });
  });
});
