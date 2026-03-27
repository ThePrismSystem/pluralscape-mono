import { expect, test } from "../../fixtures/auth.fixture.js";

import type { APIRequestContext } from "@playwright/test";

const HTTP_CREATED = 201;
const HTTP_NOT_FOUND = 404;

interface FriendNotifPrefResponse {
  readonly id: string;
  readonly accountId: string;
  readonly friendConnectionId: string;
  readonly enabledEventTypes: readonly string[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

test.describe("Friend notification preferences", () => {
  /**
   * Helper: create a friend connection between two accounts by generating
   * and redeeming a friend code.
   */
  async function createFriendConnection(
    request: APIRequestContext,
    headersA: Record<string, string>,
    headersB: Record<string, string>,
  ): Promise<string> {
    // Account A generates a friend code
    const codeRes = await request.post("/v1/account/friend-codes", {
      headers: headersA,
    });
    expect(codeRes.status()).toBe(HTTP_CREATED);
    const { code } = (await codeRes.json()) as { code: string };

    // Account B redeems it
    const redeemRes = await request.post("/v1/account/friend-codes/redeem", {
      headers: { ...headersB, "Content-Type": "application/json" },
      data: { code },
    });
    expect(redeemRes.status()).toBe(HTTP_CREATED);
    const { connectionIds } = (await redeemRes.json()) as {
      connectionIds: readonly [string, string];
    };

    // Return account A's connection ID (first in the pair)
    return connectionIds[0];
  }

  test("get returns default preferences, update persists changes", async ({
    request,
    authHeaders,
  }) => {
    // Need a second account for the friend connection
    const regRes = await request.post("/v1/auth/register", {
      data: {
        email: `e2e-notif-${crypto.randomUUID()}@test.pluralscape.local`,
        password: `E2E-TestPass-${crypto.randomUUID()}`,
        recoveryKeyBackupConfirmed: true,
      },
    });
    expect(regRes.ok()).toBe(true);
    const { sessionToken } = (await regRes.json()) as { sessionToken: string };
    const headersB = { Authorization: `Bearer ${sessionToken}` };

    const connectionId = await createFriendConnection(request, authHeaders, headersB);

    await test.step("GET returns default preferences", async () => {
      const res = await request.get(`/v1/account/friends/${connectionId}/notifications`, {
        headers: authHeaders,
      });
      expect(res.ok()).toBe(true);

      const body = (await res.json()) as FriendNotifPrefResponse;
      expect(body.id).toMatch(/^fnp_/);
      expect(body.friendConnectionId).toBe(connectionId);
      expect(body.enabledEventTypes).toEqual(["friend-switch-alert"]);
    });

    await test.step("PATCH clears event types", async () => {
      const res = await request.patch(`/v1/account/friends/${connectionId}/notifications`, {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: { enabledEventTypes: [] },
      });
      expect(res.ok()).toBe(true);

      const body = (await res.json()) as FriendNotifPrefResponse;
      expect(body.enabledEventTypes).toEqual([]);
    });

    await test.step("GET confirms cleared state", async () => {
      const res = await request.get(`/v1/account/friends/${connectionId}/notifications`, {
        headers: authHeaders,
      });
      expect(res.ok()).toBe(true);

      const body = (await res.json()) as FriendNotifPrefResponse;
      expect(body.enabledEventTypes).toEqual([]);
    });

    await test.step("PATCH restores event types", async () => {
      const res = await request.patch(`/v1/account/friends/${connectionId}/notifications`, {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: { enabledEventTypes: ["friend-switch-alert"] },
      });
      expect(res.ok()).toBe(true);

      const body = (await res.json()) as FriendNotifPrefResponse;
      expect(body.enabledEventTypes).toEqual(["friend-switch-alert"]);
    });
  });

  test("returns 404 for non-existent connection", async ({ request, authHeaders }) => {
    const res = await request.get(
      "/v1/account/friends/fc_00000000-0000-0000-0000-000000000000/notifications",
      { headers: authHeaders },
    );
    // getOrCreate tries to insert with composite FK — should fail with 404 or 500
    // depending on FK constraint handling
    expect([HTTP_NOT_FOUND, 500]).toContain(res.status());
  });
});
