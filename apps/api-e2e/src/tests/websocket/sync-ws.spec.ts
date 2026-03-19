/**
 * E2E tests for the WebSocket sync server.
 *
 * These tests connect to a real running API server with a real database.
 * The server is spawned by Playwright's globalSetup on port 10099.
 */
import { test, expect } from "../../fixtures/auth.fixture.js";
import { SyncWsClient } from "../../fixtures/ws.fixture.js";

import type { SyncError } from "@pluralscape/sync";

test.describe("WebSocket sync server", () => {
  test("authenticates successfully with valid session token", async ({
    registeredAccount,
    request,
  }) => {
    // The registered account auto-creates a system. Fetch it.
    const listRes = await request.get("/v1/systems", {
      headers: { Authorization: `Bearer ${registeredAccount.sessionToken}` },
    });
    expect(listRes.ok()).toBe(true);
    const body = (await listRes.json()) as { items: Array<{ id: string }> };
    const systemId = body.items[0]?.id ?? "";
    expect(systemId).not.toBe("");

    // Connect and authenticate via WebSocket
    const ws = new SyncWsClient();
    await ws.connect();

    try {
      const response = await ws.authenticate(registeredAccount.sessionToken, systemId);
      expect(response.type).toBe("AuthenticateResponse");
      expect(response).toHaveProperty("syncSessionId");
      expect(response).toHaveProperty("serverTime");
    } finally {
      ws.close();
    }
  });

  test("rejects authentication with invalid token", async () => {
    const ws = new SyncWsClient();
    await ws.connect();

    try {
      const response = await ws.authenticate(
        "0".repeat(64), // valid format but non-existent token
        "sys_nonexistent",
      );
      expect(response.type).toBe("SyncError");
      expect((response as SyncError).code).toBe("AUTH_FAILED");
    } finally {
      ws.close();
    }
  });

  test("rejects non-AuthenticateRequest as first message", async () => {
    const ws = new SyncWsClient();
    await ws.connect();

    try {
      ws.send({
        type: "ManifestRequest",
        correlationId: null,
        systemId: "sys_test",
      });
      const response = await ws.waitForMessage(null);
      expect(response.type).toBe("SyncError");
      expect((response as SyncError).code).toBe("AUTH_FAILED");
    } finally {
      ws.close();
    }
  });

  test("rejects malformed JSON", async () => {
    const ws = new SyncWsClient();
    await ws.connect();

    try {
      // Access raw WS to send invalid JSON
      // @ts-expect-error -- accessing private for testing
      const rawWs = ws.ws as WebSocket;
      rawWs.send("not valid json {{{");
      const response = await ws.waitForMessage(null);
      expect(response.type).toBe("SyncError");
      expect((response as SyncError).code).toBe("MALFORMED_MESSAGE");
    } finally {
      ws.close();
    }
  });
});
