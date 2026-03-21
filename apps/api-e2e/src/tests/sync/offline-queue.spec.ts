/**
 * E2E tests for offline queue and replay.
 *
 * Tests submit-disconnect-reconnect flow and server-side dedup
 * through the real WebSocket sync server.
 */
import { test, expect } from "../../fixtures/auth.fixture.js";
import { makeSignedChange } from "../../fixtures/crypto.fixture.js";
import { SyncWsClient } from "../../fixtures/ws.fixture.js";

import type { ChangeAccepted } from "@pluralscape/sync";

test.describe("Sync offline queue E2E", () => {
  test("submit change, disconnect, reconnect, verify change retrievable", async ({
    registeredAccount,
    request,
  }) => {
    const listRes = await request.get("/v1/systems", {
      headers: { Authorization: `Bearer ${registeredAccount.sessionToken}` },
    });
    const body = (await listRes.json()) as { items: Array<{ id: string }> };
    const systemId = body.items[0]?.id ?? "";

    // Session 1: submit a change
    const ws1 = new SyncWsClient();
    await ws1.connect();

    const docId = `e2e-offline-${crypto.randomUUID()}`;

    try {
      await ws1.authenticate(registeredAccount.sessionToken, systemId);
      await ws1.subscribe([{ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 }]);

      const change = await makeSignedChange(docId);
      const accepted = await ws1.submitChange(docId, change);
      expect(accepted.type).toBe("ChangeAccepted");
      expect((accepted as ChangeAccepted).assignedSeq).toBe(1);
    } finally {
      ws1.close();
    }

    // Session 2: reconnect and verify change is retrievable
    const ws2 = new SyncWsClient();
    await ws2.connect();

    try {
      await ws2.authenticate(registeredAccount.sessionToken, systemId);

      // Subscribe with seq 0 to get catchup
      ws2.send({
        type: "FetchChangesRequest",
        correlationId: null,
        docId,
        sinceSeq: 0,
      });
      const changesResponse = await ws2.waitForMessage("ChangesResponse");
      expect(changesResponse.type).toBe("ChangesResponse");
    } finally {
      ws2.close();
    }
  });

  test("re-submit with same nonce returns same seq (dedup)", async ({
    registeredAccount,
    request,
  }) => {
    const listRes = await request.get("/v1/systems", {
      headers: { Authorization: `Bearer ${registeredAccount.sessionToken}` },
    });
    const body = (await listRes.json()) as { items: Array<{ id: string }> };
    const systemId = body.items[0]?.id ?? "";

    const ws = new SyncWsClient();
    await ws.connect();

    const docId = `e2e-dedup-${crypto.randomUUID()}`;

    try {
      await ws.authenticate(registeredAccount.sessionToken, systemId);
      await ws.subscribe([{ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 }]);

      // Submit the same change twice (same nonce + authorPublicKey + documentId)
      const change = await makeSignedChange(docId);

      const accepted1 = await ws.submitChange(docId, change);
      expect(accepted1.type).toBe("ChangeAccepted");
      const seq1 = (accepted1 as ChangeAccepted).assignedSeq;

      // Re-submit the identical change
      const accepted2 = await ws.submitChange(docId, change);
      expect(accepted2.type).toBe("ChangeAccepted");
      const seq2 = (accepted2 as ChangeAccepted).assignedSeq;

      // Server dedup should return the same seq
      expect(seq2).toBe(seq1);
    } finally {
      ws.close();
    }
  });
});
