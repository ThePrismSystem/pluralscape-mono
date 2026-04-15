/**
 * Playwright fixtures for friend network E2E tests.
 *
 * Creates two independently registered accounts, generates a friend code
 * from account A, and redeems it from account B to establish a bidirectional
 * friend connection.
 */
import { test as base, expect, type APIRequestContext } from "@playwright/test";

import { registerAccount as registerTwoPhase } from "../helpers/register.js";

import { HTTP_CREATED, asAuthHeaders } from "./http.constants.js";

import type { AuthHeaders } from "./http.constants.js";

// ── Types ────────────────────────────────────────────────────────────

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

async function createAccountContext(request: APIRequestContext): Promise<AccountContext> {
  const acct = await registerTwoPhase(request, { emailPrefix: "e2e-friend" });
  return {
    accountId: acct.accountId,
    sessionToken: acct.sessionToken,
    email: acct.email,
    password: acct.password,
    headers: asAuthHeaders({ Authorization: `Bearer ${acct.sessionToken}` }),
  };
}

// ── Fixture definition ───────────────────────────────────────────────

export const test = base.extend<FriendFixtures>({
  friendAccounts: async ({ request }, use) => {
    // 1. Register two independent accounts
    const accountA = await createAccountContext(request);
    const accountB = await createAccountContext(request);

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
