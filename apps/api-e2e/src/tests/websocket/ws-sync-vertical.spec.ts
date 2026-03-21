/**
 * E2E vertical slice test for WebSocket sync.
 *
 * Exercises the full sync lifecycle using the ws-sync fixture:
 * connect -> authenticate -> subscribe -> submit change ->
 * verify subscriber receives DocumentUpdate -> disconnect.
 *
 * This complements the granular tests in sync-ws.spec.ts by testing
 * the end-to-end flow as a single cohesive scenario.
 */
import { test, expect } from "../../fixtures/auth.fixture.js";
import { createAuthenticatedWsClient, makeSignedChange } from "../../fixtures/ws-sync.fixture.js";

import type { ServerMessage } from "@pluralscape/sync";

/** Assert a ServerMessage has a specific type, narrowing for subsequent property access. */
function assertMessageType<T extends ServerMessage["type"]>(
  msg: ServerMessage,
  expectedType: T,
): asserts msg is Extract<ServerMessage, { type: T }> {
  expect(msg.type).toBe(expectedType);
}

test.describe("WebSocket sync vertical slice", () => {
  test("full lifecycle: connect, auth, subscribe, submit, receive update, disconnect", async ({
    registeredAccount,
    request,
  }) => {
    // Set up two authenticated clients for the same account
    const client1 = await createAuthenticatedWsClient(registeredAccount.sessionToken, request);
    const client2 = await createAuthenticatedWsClient(registeredAccount.sessionToken, request);

    try {
      // Both clients should be authenticated to the same system
      expect(client1.systemId).toBe(client2.systemId);
      expect(client1.syncSessionId).toBeTruthy();
      expect(client2.syncSessionId).toBeTruthy();
      // Each connection gets a unique sync session
      expect(client1.syncSessionId).not.toBe(client2.syncSessionId);

      const docId = `e2e-vertical-${crypto.randomUUID()}`;

      // Both subscribe to the same document
      const sub1 = await client1.ws.subscribe([
        { docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 },
      ]);
      assertMessageType(sub1, "SubscribeResponse");
      expect(sub1.catchup).toHaveLength(0);

      const sub2 = await client2.ws.subscribe([
        { docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 },
      ]);
      assertMessageType(sub2, "SubscribeResponse");

      // Client 1 submits a properly signed change
      const change = await makeSignedChange(docId);
      const accepted = await client1.ws.submitChange(docId, change);
      assertMessageType(accepted, "ChangeAccepted");
      expect(accepted.assignedSeq).toBe(1);
      expect(accepted.docId).toBe(docId);

      // Client 2 receives the DocumentUpdate push
      const update = await client2.ws.waitForMessage("DocumentUpdate");
      assertMessageType(update, "DocumentUpdate");
      expect(update.docId).toBe(docId);
      expect(update.changes).toHaveLength(1);
      expect(update.correlationId).toBeNull();

      // Verify the change in the update matches what was submitted
      const receivedChange = update.changes[0];
      expect(receivedChange).toBeDefined();
      expect(receivedChange?.documentId).toBe(docId);
      expect(receivedChange?.seq).toBe(1);
    } finally {
      // Clean disconnect
      client1.ws.close();
      client2.ws.close();
    }
  });

  test("unsubscribe stops receiving updates for that document", async ({
    registeredAccount,
    request,
  }) => {
    const client1 = await createAuthenticatedWsClient(registeredAccount.sessionToken, request);
    const client2 = await createAuthenticatedWsClient(registeredAccount.sessionToken, request);

    try {
      const docId = `e2e-unsub-${crypto.randomUUID()}`;

      // Both subscribe
      await client1.ws.subscribe([{ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 }]);
      await client2.ws.subscribe([{ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 }]);

      // Client 2 unsubscribes
      client2.ws.send({
        type: "UnsubscribeRequest",
        correlationId: null,
        docId,
      });

      // Barrier: subscribe to a dummy doc to ensure the server has processed
      // the unsubscribe (messages are processed in-order per connection)
      const barrierDocId = `e2e-barrier-${crypto.randomUUID()}`;
      await client2.ws.subscribe([
        { docId: barrierDocId, lastSyncedSeq: 0, lastSnapshotVersion: 0 },
      ]);

      // Client 1 submits a change
      const change = await makeSignedChange(docId);
      const accepted = await client1.ws.submitChange(docId, change);
      assertMessageType(accepted, "ChangeAccepted");

      // Client 2 should NOT receive the update — expect timeout
      await expect(client2.ws.waitForMessage("DocumentUpdate", 2_000)).rejects.toThrow("Timeout");
    } finally {
      client1.ws.close();
      client2.ws.close();
    }
  });

  test("subscriber receives catchup on reconnect with stale seq", async ({
    registeredAccount,
    request,
  }) => {
    const client1 = await createAuthenticatedWsClient(registeredAccount.sessionToken, request);

    const docId = `e2e-catchup-${crypto.randomUUID()}`;

    try {
      // Subscribe and submit a change
      await client1.ws.subscribe([{ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 }]);

      const change = await makeSignedChange(docId);
      const accepted = await client1.ws.submitChange(docId, change);
      assertMessageType(accepted, "ChangeAccepted");
    } finally {
      client1.ws.close();
    }

    // New client connects and subscribes with seq 0 — should get catchup
    const client2 = await createAuthenticatedWsClient(registeredAccount.sessionToken, request);

    try {
      const sub = await client2.ws.subscribe([{ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 }]);
      assertMessageType(sub, "SubscribeResponse");

      expect(sub.catchup.length).toBeGreaterThan(0);

      const docCatchup = sub.catchup.find((c) => c.docId === docId);
      expect(docCatchup).toBeDefined();
      expect(docCatchup?.changes.length).toBeGreaterThan(0);
    } finally {
      client2.ws.close();
    }
  });

  test("clean disconnect does not affect other connected clients", async ({
    registeredAccount,
    request,
  }) => {
    const client1 = await createAuthenticatedWsClient(registeredAccount.sessionToken, request);
    const client2 = await createAuthenticatedWsClient(registeredAccount.sessionToken, request);
    const client3 = await createAuthenticatedWsClient(registeredAccount.sessionToken, request);

    const docId = `e2e-disconnect-${crypto.randomUUID()}`;

    try {
      // All three subscribe
      await client1.ws.subscribe([{ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 }]);
      await client2.ws.subscribe([{ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 }]);
      await client3.ws.subscribe([{ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 }]);

      // Client 2 disconnects
      client2.ws.close();

      // Client 1 submits a change
      const change = await makeSignedChange(docId);
      const accepted = await client1.ws.submitChange(docId, change);
      assertMessageType(accepted, "ChangeAccepted");

      // Client 3 should still receive the update
      const update = await client3.ws.waitForMessage("DocumentUpdate");
      assertMessageType(update, "DocumentUpdate");
      expect(update.docId).toBe(docId);
    } finally {
      client1.ws.close();
      // client2 already closed
      client3.ws.close();
    }
  });
});
