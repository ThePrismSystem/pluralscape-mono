/**
 * Playwright fixtures for friend network E2E tests.
 *
 * Creates two independently registered accounts, generates a friend code
 * from account A, and redeems it from account B to establish a bidirectional
 * friend connection.
 */
import crypto from "node:crypto";

import { test as base, expect, type APIRequestContext } from "@playwright/test";

import { HTTP_CREATED, asAuthHeaders } from "./http.constants.js";

import type { AuthHeaders } from "./http.constants.js";

// ── Types ────────────────────────────────────────────────────────────

interface RegisterData {
  sessionToken: string;
  recoveryKey: string;
  accountId: string;
  accountType: string;
}

interface RegisterResponse {
  data: RegisterData;
}

interface AccountContext {
  readonly accountId: string;
  readonly sessionToken: string;
  readonly email: string;
  readonly password: string;
  readonly headers: AuthHeaders;
}

interface FriendCodeResponse {
  data: {
    readonly id: string;
    readonly accountId: string;
    readonly code: string;
    readonly createdAt: number;
    readonly expiresAt: number | null;
    readonly archived: boolean;
  };
}

interface RedeemResponse {
  data: {
    readonly connectionIds: readonly [string, string];
  };
}

interface FriendFixtureContext {
  /** Account A (the code generator / initiator). */
  readonly accountA: AccountContext;
  /** Account B (the code redeemer). */
  readonly accountB: AccountContext;
  /** Connection ID owned by account A (A's view of the connection). */
  readonly connectionIdA: string;
  /** Connection ID owned by account B (B's view of the connection). */
  readonly connectionIdB: string;
}

interface FriendFixtures {
  /** Two connected friend accounts with both connection IDs. */
  friendAccounts: FriendFixtureContext;
}

// ── Helpers ──────────────────────────────────────────────────────────

async function registerAccount(request: APIRequestContext): Promise<AccountContext> {
  const uuid = crypto.randomUUID();
  const email = `e2e-friend-${uuid}@test.pluralscape.local`;
  const password = `E2E-FriendPass-${uuid}`;

  const res = await request.post("/v1/auth/register", {
    data: {
      email,
      password,
      recoveryKeyBackupConfirmed: true,
    },
  });

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Registration failed (${String(res.status())}): ${body}`);
  }

  const envelope = (await res.json()) as RegisterResponse;
  return {
    accountId: envelope.data.accountId,
    sessionToken: envelope.data.sessionToken,
    email,
    password,
    headers: asAuthHeaders({ Authorization: `Bearer ${envelope.data.sessionToken}` }),
  };
}

// ── Fixture definition ───────────────────────────────────────────────

export const test = base.extend<FriendFixtures>({
  friendAccounts: async ({ request }, use) => {
    // 1. Register two independent accounts
    const accountA = await registerAccount(request);
    const accountB = await registerAccount(request);

    // 2. Account A generates a friend code
    const codeRes = await request.post("/v1/account/friend-codes", {
      headers: accountA.headers,
    });
    expect(codeRes.status()).toBe(HTTP_CREATED);
    const friendCodeEnvelope = (await codeRes.json()) as FriendCodeResponse;

    // 3. Account B redeems the code
    const redeemRes = await request.post("/v1/account/friend-codes/redeem", {
      headers: accountB.headers,
      data: { code: friendCodeEnvelope.data.code },
    });
    expect(redeemRes.status()).toBe(HTTP_CREATED);
    const redeemResult = (await redeemRes.json()) as RedeemResponse;

    // connectionIds[0] is A's connection (code owner), connectionIds[1] is B's connection (redeemer)
    const [connectionIdA, connectionIdB] = redeemResult.data.connectionIds;

    // 4. Account A accepts — transitions both sides to "accepted"
    const acceptA = await request.post(`/v1/account/friends/${connectionIdA}/accept`, {
      headers: accountA.headers,
    });
    expect(acceptA.ok()).toBe(true);

    await use({
      accountA,
      accountB,
      connectionIdA,
      connectionIdB,
    });
  },
});

export { expect } from "@playwright/test";
