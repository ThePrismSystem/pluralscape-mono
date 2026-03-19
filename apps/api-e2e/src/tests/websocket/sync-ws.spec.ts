/**
 * E2E tests for the WebSocket sync server.
 *
 * These tests connect to a real running API server with a real database.
 * The server is spawned by Playwright's globalSetup on port 10099.
 */
import { test, expect } from "../../fixtures/auth.fixture.js";
import { SyncWsClient } from "../../fixtures/ws.fixture.js";

import type { SubscribeResponse, SyncError } from "@pluralscape/sync";

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

  test("subscribe and submit change flow", async ({ registeredAccount, request }) => {
    const listRes = await request.get("/v1/systems", {
      headers: { Authorization: `Bearer ${registeredAccount.sessionToken}` },
    });
    const body = (await listRes.json()) as { items: Array<{ id: string }> };
    const systemId = body.items[0]?.id ?? "";

    // Two connections for the same account
    const ws1 = new SyncWsClient();
    const ws2 = new SyncWsClient();
    await ws1.connect();
    await ws2.connect();

    try {
      await ws1.authenticate(registeredAccount.sessionToken, systemId);
      await ws2.authenticate(registeredAccount.sessionToken, systemId);

      const docId = `e2e-doc-${crypto.randomUUID()}`;

      // Both subscribe to the same doc
      const sub1 = await ws1.subscribe([{ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 }]);
      expect(sub1.type).toBe("SubscribeResponse");
      expect((sub1 as SubscribeResponse).catchup).toHaveLength(0);

      await ws2.subscribe([{ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 }]);

      // ws1 submits a change
      const change = {
        ciphertext: Buffer.from("encrypted-data").toString("base64url"),
        nonce: Buffer.from("nonce-value-24bytes!!!!").toString("base64url"),
        signature: Buffer.from("sig-value-64bytes" + "x".repeat(46)).toString("base64url"),
        authorPublicKey: Buffer.from("pub-key-32bytes" + "x".repeat(17)).toString("base64url"),
        documentId: docId,
      };
      const accepted = await ws1.submitChange(docId, change);
      expect(accepted.type).toBe("ChangeAccepted");

      // ws2 should receive DocumentUpdate broadcast
      const update = await ws2.waitForMessage("DocumentUpdate");
      expect(update.type).toBe("DocumentUpdate");
    } finally {
      ws1.close();
      ws2.close();
    }
  });

  test("rejects subscribe with too many documents", async ({ registeredAccount, request }) => {
    const listRes = await request.get("/v1/systems", {
      headers: { Authorization: `Bearer ${registeredAccount.sessionToken}` },
    });
    const body = (await listRes.json()) as { items: Array<{ id: string }> };
    const systemId = body.items[0]?.id ?? "";

    const ws = new SyncWsClient();
    await ws.connect();

    try {
      await ws.authenticate(registeredAccount.sessionToken, systemId);

      // Send SubscribeRequest with 101 documents (over the 100 limit)
      const documents = Array.from({ length: 101 }, (_, i) => ({
        docId: `doc-${String(i)}`,
        lastSyncedSeq: 0,
        lastSnapshotVersion: 0,
      }));
      ws.send({
        type: "SubscribeRequest",
        correlationId: null,
        documents,
      });
      const response = await ws.waitForMessage(null);
      expect(response.type).toBe("SyncError");
      expect((response as SyncError).code).toBe("MALFORMED_MESSAGE");
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
