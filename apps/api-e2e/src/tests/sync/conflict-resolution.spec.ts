/**
 * E2E tests for sync conflict resolution.
 *
 * Tests two-client convergence and tombstone propagation through the
 * real WebSocket sync server.
 */
import { test, expect } from "../../fixtures/auth.fixture.js";
import {
  makeSignedChange,
  createAccountSyncContext,
  asSyncDocId,
} from "../../fixtures/crypto.fixture.js";
import { SyncWsClient } from "../../fixtures/ws.fixture.js";

import type { ChangeAccepted, DocumentUpdate, SubscribeResponse } from "@pluralscape/sync";

test.describe("Sync conflict resolution E2E", () => {
  test("two-client convergence: both clients submit changes and receive updates", async ({
    registeredAccount,
    request,
  }) => {
    const listRes = await request.get("/v1/systems", {
      headers: { Authorization: `Bearer ${registeredAccount.sessionToken}` },
    });
    const body = (await listRes.json()) as { data: Array<{ id: string }> };
    const systemId = body.data[0]?.id ?? "";

    const ws1 = new SyncWsClient();
    const ws2 = new SyncWsClient();
    await ws1.connect();
    await ws2.connect();

    try {
      await ws1.authenticate(registeredAccount.sessionToken, systemId);
      await ws2.authenticate(registeredAccount.sessionToken, systemId);

      const docId = asSyncDocId(`e2e-conflict-${crypto.randomUUID()}`);

      // Both subscribe to the same document
      const sub1 = await ws1.subscribe([{ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 }]);
      expect(sub1.type).toBe("SubscribeResponse");
      expect((sub1 as SubscribeResponse).catchup).toHaveLength(0);

      await ws2.subscribe([{ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 }]);

      // Client 1 submits a change
      const ctx = await createAccountSyncContext(registeredAccount.signingKeypair);
      const change1 = await makeSignedChange(docId, ctx);
      const accepted1 = await ws1.submitChange(docId, change1);
      expect(accepted1.type).toBe("ChangeAccepted");
      expect((accepted1 as ChangeAccepted).assignedSeq).toBe(1);

      // Client 2 should receive the update
      const update1 = await ws2.waitForMessage("DocumentUpdate");
      expect(update1.type).toBe("DocumentUpdate");
      expect((update1 as DocumentUpdate).docId).toBe(docId);

      // Client 2 submits a change
      const change2 = await makeSignedChange(docId, ctx);
      const accepted2 = await ws2.submitChange(docId, change2);
      expect(accepted2.type).toBe("ChangeAccepted");
      expect((accepted2 as ChangeAccepted).assignedSeq).toBe(2);

      // Client 1 should receive the update
      const update2 = await ws1.waitForMessage("DocumentUpdate");
      expect(update2.type).toBe("DocumentUpdate");

      // Both clients can fetch all changes via FetchChangesRequest
      ws1.send({
        type: "FetchChangesRequest",
        correlationId: null,
        docId,
        sinceSeq: 0,
      });
      const changesResponse = await ws1.waitForMessage("ChangesResponse");
      expect(changesResponse.type).toBe("ChangesResponse");
    } finally {
      ws1.close();
      ws2.close();
    }
  });

  // E2E limitation: this test verifies transport-level change delivery, not CRDT tombstone
  // semantics. Actual tombstone enforcement (archive-wins) is tested in the PostMergeValidator
  // unit tests where we have access to real Automerge documents.
  test("change propagation: client A submits, client B receives push (transport-level tombstone delivery)", async ({
    registeredAccount,
    request,
  }) => {
    const listRes = await request.get("/v1/systems", {
      headers: { Authorization: `Bearer ${registeredAccount.sessionToken}` },
    });
    const body = (await listRes.json()) as { data: Array<{ id: string }> };
    const systemId = body.data[0]?.id ?? "";

    const ws1 = new SyncWsClient();
    const ws2 = new SyncWsClient();
    await ws1.connect();
    await ws2.connect();

    try {
      await ws1.authenticate(registeredAccount.sessionToken, systemId);
      await ws2.authenticate(registeredAccount.sessionToken, systemId);

      const docId = asSyncDocId(`e2e-tombstone-${crypto.randomUUID()}`);

      await ws1.subscribe([{ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 }]);
      await ws2.subscribe([{ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 }]);

      // Client 1 submits a change (simulating an archive operation)
      const ctx = await createAccountSyncContext(registeredAccount.signingKeypair);
      const archiveChange = await makeSignedChange(docId, ctx);
      const accepted = await ws1.submitChange(docId, archiveChange);
      expect(accepted.type).toBe("ChangeAccepted");

      // Client 2 should receive the tombstone update via push
      const update = await ws2.waitForMessage("DocumentUpdate");
      expect(update.type).toBe("DocumentUpdate");
      expect((update as DocumentUpdate).docId).toBe(docId);
      expect((update as DocumentUpdate).changes).toHaveLength(1);
    } finally {
      ws1.close();
      ws2.close();
    }
  });
});
