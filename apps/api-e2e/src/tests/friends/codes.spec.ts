import crypto from "node:crypto";

import { expect, test } from "../../fixtures/auth.fixture.js";

// ── Constants ────────────────────────────────────────────────────────

/** HTTP 201 Created status code. */
const HTTP_CREATED = 201;

/** HTTP 204 No Content status code. */
const HTTP_NO_CONTENT = 204;

/** HTTP 409 Conflict status code. */
const HTTP_CONFLICT = 409;

/** Expected friend code format: XXXX-XXXX uppercase alphanumeric. */
const FRIEND_CODE_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

// ── Types ────────────────────────────────────────────────────────────

interface FriendCodeResponse {
  readonly id: string;
  readonly accountId: string;
  readonly code: string;
  readonly createdAt: number;
  readonly expiresAt: number | null;
  readonly archived: boolean;
}

interface FriendCodeListResponse {
  readonly items: readonly FriendCodeResponse[];
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

// ── Tests ────────────────────────────────────────────────────────────

test.describe("Friend codes", () => {
  test("generate, list, and archive lifecycle", async ({ request, authHeaders }) => {
    let codeId: string;
    let codeValue: string;

    // ── Generate ──
    await test.step("generate a friend code", async () => {
      const res = await request.post("/v1/account/friend-codes", {
        headers: authHeaders,
      });
      expect(res.status()).toBe(HTTP_CREATED);

      const body = (await res.json()) as FriendCodeResponse;
      expect(body.id).toMatch(/^frc_/);
      expect(body.code).toMatch(FRIEND_CODE_PATTERN);
      expect(body.archived).toBe(false);
      expect(body.createdAt).toBeGreaterThan(0);

      codeId = body.id;
      codeValue = body.code;
    });

    // ── List ──
    await test.step("list includes generated code", async () => {
      const res = await request.get("/v1/account/friend-codes", {
        headers: authHeaders,
      });
      expect(res.ok()).toBe(true);

      const body = (await res.json()) as FriendCodeListResponse;
      const ids = body.items.map((c) => c.id);
      expect(ids).toContain(codeId);

      const found = body.items.find((c) => c.id === codeId);
      expect(found?.code).toBe(codeValue);
    });

    // ── Archive ──
    await test.step("archive the code", async () => {
      const res = await request.post(`/v1/account/friend-codes/${codeId}/archive`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(HTTP_NO_CONTENT);
    });

    await test.step("archived code is not in list", async () => {
      const res = await request.get("/v1/account/friend-codes", {
        headers: authHeaders,
      });
      expect(res.ok()).toBe(true);

      const body = (await res.json()) as FriendCodeListResponse;
      const ids = body.items.map((c) => c.id);
      expect(ids).not.toContain(codeId);
    });
  });

  test("self-redeem prevention returns 409", async ({ request, authHeaders }) => {
    // Generate a code
    const genRes = await request.post("/v1/account/friend-codes", {
      headers: authHeaders,
    });
    expect(genRes.status()).toBe(HTTP_CREATED);
    const code = (await genRes.json()) as FriendCodeResponse;

    // Attempt to redeem own code
    const redeemRes = await request.post("/v1/account/friend-codes/redeem", {
      headers: authHeaders,
      data: { code: code.code },
    });
    expect(redeemRes.status()).toBe(HTTP_CONFLICT);

    const body = (await redeemRes.json()) as { error: { code: string } };
    expect(body.error.code).toBe("CONFLICT");
  });

  test("redeem non-existent code returns 404", async ({ request, authHeaders }) => {
    const res = await request.post("/v1/account/friend-codes/redeem", {
      headers: authHeaders,
      data: { code: "ZZZZ-ZZZZ" },
    });
    expect(res.status()).toBe(404);
  });

  test("redeem with invalid format returns 400", async ({ request, authHeaders }) => {
    const res = await request.post("/v1/account/friend-codes/redeem", {
      headers: authHeaders,
      data: { code: "bad-format" },
    });
    expect(res.status()).toBe(400);
  });

  test("archive non-existent code returns 404", async ({ request, authHeaders }) => {
    const res = await request.post(
      "/v1/account/friend-codes/frc_00000000-0000-0000-0000-000000000001/archive",
      { headers: authHeaders },
    );
    expect(res.status()).toBe(404);
  });

  test("redeem returns 409 when already friends", async ({ request }) => {
    // Register two accounts
    const uuidA = crypto.randomUUID();
    const uuidB = crypto.randomUUID();

    const regA = await request.post("/v1/auth/register", {
      data: {
        email: `e2e-dup-${uuidA}@test.pluralscape.local`,
        password: `E2E-Pass-${uuidA}`,
        recoveryKeyBackupConfirmed: true,
      },
    });
    expect(regA.ok()).toBe(true);
    const accountA = (await regA.json()) as { sessionToken: string; accountId: string };
    const headersA = { Authorization: `Bearer ${accountA.sessionToken}` };

    const regB = await request.post("/v1/auth/register", {
      data: {
        email: `e2e-dup-${uuidB}@test.pluralscape.local`,
        password: `E2E-Pass-${uuidB}`,
        recoveryKeyBackupConfirmed: true,
      },
    });
    expect(regB.ok()).toBe(true);
    const accountB = (await regB.json()) as { sessionToken: string; accountId: string };
    const headersB = { Authorization: `Bearer ${accountB.sessionToken}` };

    // Account A generates a code, Account B redeems it (they become friends)
    const codeResA = await request.post("/v1/account/friend-codes", {
      headers: headersA,
    });
    expect(codeResA.status()).toBe(HTTP_CREATED);
    const friendCodeA = (await codeResA.json()) as FriendCodeResponse;

    const redeemRes = await request.post("/v1/account/friend-codes/redeem", {
      headers: headersB,
      data: { code: friendCodeA.code },
    });
    expect(redeemRes.status()).toBe(HTTP_CREATED);

    // Account B generates a NEW code, Account A tries to redeem it
    const codeResB = await request.post("/v1/account/friend-codes", {
      headers: headersB,
    });
    expect(codeResB.status()).toBe(HTTP_CREATED);
    const friendCodeB = (await codeResB.json()) as FriendCodeResponse;

    const duplicateRedeem = await request.post("/v1/account/friend-codes/redeem", {
      headers: headersA,
      data: { code: friendCodeB.code },
    });
    expect(duplicateRedeem.status()).toBe(HTTP_CONFLICT);
  });

  test("redeem between two accounts creates bidirectional connection", async ({ request }) => {
    // Register two accounts
    const uuidA = crypto.randomUUID();
    const uuidB = crypto.randomUUID();

    const regA = await request.post("/v1/auth/register", {
      data: {
        email: `e2e-codes-${uuidA}@test.pluralscape.local`,
        password: `E2E-Pass-${uuidA}`,
        recoveryKeyBackupConfirmed: true,
      },
    });
    expect(regA.ok()).toBe(true);
    const accountA = (await regA.json()) as { sessionToken: string; accountId: string };
    const headersA = { Authorization: `Bearer ${accountA.sessionToken}` };

    const regB = await request.post("/v1/auth/register", {
      data: {
        email: `e2e-codes-${uuidB}@test.pluralscape.local`,
        password: `E2E-Pass-${uuidB}`,
        recoveryKeyBackupConfirmed: true,
      },
    });
    expect(regB.ok()).toBe(true);
    const accountB = (await regB.json()) as { sessionToken: string; accountId: string };
    const headersB = { Authorization: `Bearer ${accountB.sessionToken}` };

    // Account A generates a code
    const codeRes = await request.post("/v1/account/friend-codes", {
      headers: headersA,
    });
    expect(codeRes.status()).toBe(HTTP_CREATED);
    const friendCode = (await codeRes.json()) as FriendCodeResponse;

    // Account B redeems it
    const redeemRes = await request.post("/v1/account/friend-codes/redeem", {
      headers: headersB,
      data: { code: friendCode.code },
    });
    expect(redeemRes.status()).toBe(HTTP_CREATED);

    const result = (await redeemRes.json()) as { connectionIds: readonly [string, string] };
    expect(result.connectionIds).toHaveLength(2);
    expect(result.connectionIds[0]).toMatch(/^fc_/);
    expect(result.connectionIds[1]).toMatch(/^fc_/);

    // Both accounts should see the connection in their list
    const listA = await request.get("/v1/account/friends", { headers: headersA });
    expect(listA.ok()).toBe(true);
    const bodyA = (await listA.json()) as { items: { id: string; status: string }[] };
    const connA = bodyA.items.find((c) => c.id === result.connectionIds[0]);
    expect(connA).toBeTruthy();
    expect(connA?.status).toBe("pending");

    const listB = await request.get("/v1/account/friends", { headers: headersB });
    expect(listB.ok()).toBe(true);
    const bodyB = (await listB.json()) as { items: { id: string; status: string }[] };
    const connB = bodyB.items.find((c) => c.id === result.connectionIds[1]);
    expect(connB).toBeTruthy();
    expect(connB?.status).toBe("pending");

    // Redeeming the same code again should fail (code was auto-archived)
    const redeemAgain = await request.post("/v1/account/friend-codes/redeem", {
      headers: headersB,
      data: { code: friendCode.code },
    });
    expect(redeemAgain.status()).toBe(404);
  });
});
