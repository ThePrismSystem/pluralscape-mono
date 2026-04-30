import { initSodium } from "@pluralscape/crypto";
import { brandId } from "@pluralscape/types";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@pluralscape/sync", async () => {
  const actual = await vi.importActual<typeof import("@pluralscape/sync")>("@pluralscape/sync");
  return {
    ...actual,
    verifyEnvelopeSignature: vi.fn(() => true),
  };
});

import { ConnectionManager } from "../../ws/connection-manager.js";
import { createRouterContext, routeMessage } from "../../ws/message-router.js";

import {
  addAuthedConnection,
  authRequest,
  lastResponse,
  makeBrokenRelayContext,
  makeBrokenWsConnection,
  makeChangePayload,
  makeMockLog,
  makeMockWs,
  makeSnapshotPayload,
} from "./message-router-fixtures.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { SyncConnectionState } from "../../ws/connection-state.js";
import type { RouterContext } from "../../ws/message-router.js";
import type { AccountId, SessionId, SystemId } from "@pluralscape/types";

vi.mock("../../lib/session-auth.js", () => ({
  validateSession: vi.fn().mockResolvedValue({
    ok: true,
    auth: {
      authMethod: "session" as const,
      accountId: brandId<AccountId>("acct_test"),
      systemId: brandId<SystemId>("sys_test"),
      sessionId: brandId<SessionId>("sess_test"),
      accountType: "system",
      ownedSystemIds: new Set([brandId<SystemId>("sys_test")]),
      auditLogIpTracking: false,
    } satisfies AuthContext,
    session: {},
  }),
}));

const mockDbLimit = vi.fn().mockResolvedValue([]);
const mockWhereRows: unknown[] = [
  { publicKey: new Uint8Array(32).fill(4) },
  { publicKey: new Uint8Array(32).fill(8) },
];
const mockDbChain: Record<string, unknown> = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn(() => ({
    limit: mockDbLimit,
    then(resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) {
      return Promise.resolve(mockWhereRows).then(resolve, reject);
    },
  })),
  limit: mockDbLimit,
};
const mockDb = {
  select: vi.fn().mockReturnValue(mockDbChain),
  execute: vi.fn().mockResolvedValue(undefined),
  transaction: vi.fn(async (fn: (tx: typeof mockDb) => Promise<unknown>) => fn(mockDb)),
};

vi.mock("../../lib/db.js", () => ({
  getDb: vi.fn().mockImplementation(() => Promise.resolve(mockDb)),
}));

const sent: string[] = [];

describe("message-router — error paths and broken-ws resilience", () => {
  let manager: ConnectionManager;
  let state: SyncConnectionState;
  let ctx: RouterContext;
  const log = makeMockLog();

  beforeAll(async () => {
    await initSodium();
  });

  beforeEach(() => {
    manager = new ConnectionManager();
    manager.reserveUnauthSlot();
    state = manager.register("conn-1", makeMockWs(sent) as never, Date.now());
    ctx = createRouterContext(1000, manager);
    sent.length = 0;
  });

  afterEach(() => {
    manager.closeAll(1001, "test cleanup");
    ctx.documentOwnership.clear();
  });

  describe("document access control — error paths", () => {
    beforeEach(async () => {
      await routeMessage(authRequest(), state, log, ctx);
      const refreshed = manager.get("conn-1");
      if (!refreshed) throw new Error("State not found after auth");
      state = refreshed;
      sent.length = 0;
    });

    it("SubmitChangeRequest skips broadcast on send failure", async () => {
      const broken = makeBrokenWsConnection("conn-broken");
      const { ws: subWs } = addAuthedConnection(broken.manager, "conn-sub");
      broken.manager.addSubscription("conn-sub", "doc-bc");

      const change = makeChangePayload("doc-bc");
      await routeMessage(
        JSON.stringify({
          type: "SubmitChangeRequest",
          correlationId: null,
          docId: "doc-bc",
          change,
        }),
        broken.state,
        log,
        broken.ctx,
      );

      // Subscriber should NOT have received broadcast since send to submitter failed
      expect(subWs.send).not.toHaveBeenCalled();
      broken.manager.closeAll(1001, "test cleanup");
    });

    it("sends INTERNAL_ERROR when handleSubmitSnapshot throws unexpected error", async () => {
      const brokenCtx = makeBrokenRelayContext(manager, {
        submitSnapshot: () => {
          throw new Error("unexpected relay failure");
        },
        getEnvelopesSince: () => [],
        getLatestSnapshot: () => null,
      });

      await routeMessage(
        JSON.stringify({
          type: "SubmitSnapshotRequest",
          correlationId: "550e8400-e29b-41d4-a716-446655440000",
          docId: "doc-snap-err",
          snapshot: makeSnapshotPayload("doc-snap-err", 1),
        }),
        state,
        log,
        brokenCtx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("INTERNAL_ERROR");
      expect(resp["message"]).toBe("Failed to process SubmitSnapshotRequest");
    });

    it("sends INTERNAL_ERROR when handleManifestRequest throws", async () => {
      const brokenCtx = makeBrokenRelayContext(manager, {
        getManifest: () => {
          throw new Error("manifest failure");
        },
      });

      await routeMessage(
        JSON.stringify({
          type: "ManifestRequest",
          correlationId: "550e8400-e29b-41d4-a716-446655440000",
          systemId: "sys_test",
        }),
        state,
        log,
        brokenCtx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("INTERNAL_ERROR");
      expect(resp["message"]).toBe("Failed to process manifest");
    });

    it("drops document and returns SubscribeResponse when catchup fetch fails", async () => {
      const brokenCtx = makeBrokenRelayContext(manager, {
        getEnvelopesSince: () => {
          throw new Error("subscribe failure");
        },
      });

      await routeMessage(
        JSON.stringify({
          type: "SubscribeRequest",
          correlationId: "550e8400-e29b-41d4-a716-446655440000",
          documents: [{ docId: "doc-sub-err", lastSyncedSeq: 0, lastSnapshotVersion: 0 }],
        }),
        state,
        log,
        brokenCtx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SubscribeResponse");
      expect(resp["droppedDocIds"]).toContain("doc-sub-err");
    });

    it("sends INTERNAL_ERROR when handleSubmitChange throws", async () => {
      const brokenCtx = makeBrokenRelayContext(manager, {
        submit: () => {
          throw new Error("change failure");
        },
      });

      const change = makeChangePayload("doc-change-err");
      await routeMessage(
        JSON.stringify({
          type: "SubmitChangeRequest",
          correlationId: "550e8400-e29b-41d4-a716-446655440000",
          docId: "doc-change-err",
          change,
        }),
        state,
        log,
        brokenCtx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("INTERNAL_ERROR");
      expect(resp["message"]).toBe("Failed to process SubmitChangeRequest");
    });

    it("returns INVALID_ENVELOPE and skips broadcast when signature verification fails", async () => {
      const syncModule = await import("@pluralscape/sync");
      const spy = vi.spyOn(syncModule, "verifyEnvelopeSignature").mockReturnValue(false);

      // Register a subscriber under a different system to verify no broadcast.
      const { ws: subWs } = addAuthedConnection(manager, "conn-sub", brandId<SystemId>("sys_sub"));
      manager.addSubscription("conn-sub", "doc-sig-fail");

      const change = makeChangePayload("doc-sig-fail");
      await routeMessage(
        JSON.stringify({
          type: "SubmitChangeRequest",
          correlationId: "550e8400-e29b-41d4-a716-446655440000",
          docId: "doc-sig-fail",
          change,
        }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("INVALID_ENVELOPE");

      // Subscriber should NOT have received a DocumentUpdate broadcast
      expect(subWs.send).not.toHaveBeenCalled();

      // Ownership should NOT have been set
      expect(ctx.documentOwnership.has("doc-sig-fail")).toBe(false);

      // Restore so later tests use the default mock (verifyEnvelopeSignature=true)
      spy.mockRestore();
    });

    it("sends INTERNAL_ERROR when handleDocumentLoad throws", async () => {
      const brokenCtx = makeBrokenRelayContext(manager, {
        getLatestSnapshot: () => {
          throw new Error("load failure");
        },
      });

      await routeMessage(
        JSON.stringify({
          type: "DocumentLoadRequest",
          correlationId: "550e8400-e29b-41d4-a716-446655440000",
          docId: "doc-load-err",
          persist: false,
        }),
        state,
        log,
        brokenCtx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("INTERNAL_ERROR");
      expect(resp["message"]).toBe("Failed to load document");
    });

    it("sends INTERNAL_ERROR when FetchSnapshotRequest handler throws via dispatchWithAccess", async () => {
      const brokenCtx = makeBrokenRelayContext(manager, {
        getLatestSnapshot: () => {
          throw new Error("fetch failure");
        },
      });

      await routeMessage(
        JSON.stringify({
          type: "FetchSnapshotRequest",
          correlationId: "550e8400-e29b-41d4-a716-446655440000",
          docId: "doc-fetch-err",
        }),
        state,
        log,
        brokenCtx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("INTERNAL_ERROR");
      expect(resp["message"]).toBe("Failed to process FetchSnapshotRequest");
    });

    it("sends INTERNAL_ERROR when FetchChangesRequest handler throws", async () => {
      const brokenCtx = makeBrokenRelayContext(manager, {
        getEnvelopesSince: () => {
          throw new Error("changes fetch failure");
        },
      });

      await routeMessage(
        JSON.stringify({
          type: "FetchChangesRequest",
          correlationId: "550e8400-e29b-41d4-a716-446655440000",
          docId: "doc-changes-err",
          sinceSeq: 0,
        }),
        state,
        log,
        brokenCtx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("INTERNAL_ERROR");
      expect(resp["message"]).toBe("Failed to process FetchChangesRequest");
    });

    it("SubmitSnapshotRequest VERSION_CONFLICT does not set ownership", async () => {
      // First submit to establish version 2
      await routeMessage(
        JSON.stringify({
          type: "SubmitSnapshotRequest",
          correlationId: null,
          docId: "doc-vc",
          snapshot: makeSnapshotPayload("doc-vc", 2),
        }),
        state,
        log,
        ctx,
      );
      sent.length = 0;
      ctx.documentOwnership.clear();

      // Now submit stale version 1 — should get VERSION_CONFLICT
      await routeMessage(
        JSON.stringify({
          type: "SubmitSnapshotRequest",
          correlationId: null,
          docId: "doc-vc",
          snapshot: makeSnapshotPayload("doc-vc", 1, 5),
        }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("VERSION_CONFLICT");
      // Ownership should NOT be set after a VERSION_CONFLICT
      expect(ctx.documentOwnership.has("doc-vc")).toBe(false);
    });

    it("ManifestRequest with broken ws does not crash", async () => {
      const broken = makeBrokenWsConnection("conn-broken-mfst");

      await expect(
        routeMessage(
          JSON.stringify({
            type: "ManifestRequest",
            correlationId: null,
            systemId: "sys_test",
          }),
          broken.state,
          log,
          broken.ctx,
        ),
      ).resolves.not.toThrow();

      broken.manager.closeAll(1001, "test cleanup");
    });

    it("SubscribeRequest with broken ws does not crash", async () => {
      const broken = makeBrokenWsConnection("conn-broken-sub");

      await expect(
        routeMessage(
          JSON.stringify({
            type: "SubscribeRequest",
            correlationId: null,
            documents: [{ docId: "doc-1", lastSyncedSeq: 0, lastSnapshotVersion: 0 }],
          }),
          broken.state,
          log,
          broken.ctx,
        ),
      ).resolves.not.toThrow();

      broken.manager.closeAll(1001, "test cleanup");
    });

    it("SubmitSnapshotRequest with broken ws does not crash", async () => {
      const broken = makeBrokenWsConnection("conn-broken-snap");
      const snapshot = makeSnapshotPayload("doc-snap-broken", 1);

      await expect(
        routeMessage(
          JSON.stringify({
            type: "SubmitSnapshotRequest",
            correlationId: null,
            docId: "doc-snap-broken",
            snapshot,
          }),
          broken.state,
          log,
          broken.ctx,
        ),
      ).resolves.not.toThrow();

      broken.manager.closeAll(1001, "test cleanup");
    });

    it("does not send double response when onSuccess side-effect throws", async () => {
      const throwingOwnership = new Map<string, SystemId>();
      Object.defineProperty(throwingOwnership, "set", {
        value: () => {
          throw new Error("ownership set failed");
        },
      });
      const brokenCtx: RouterContext = {
        relay: ctx.relay,
        documentOwnership: throwingOwnership,
        manager,
        pubsub: null,
      };

      const change = makeChangePayload("doc-onsuccess-err");
      await routeMessage(
        JSON.stringify({
          type: "SubmitChangeRequest",
          correlationId: "550e8400-e29b-41d4-a716-446655440000",
          docId: "doc-onsuccess-err",
          change,
        }),
        state,
        log,
        brokenCtx,
      );

      // Should see exactly one response: ChangeAccepted (NOT an additional INTERNAL_ERROR)
      const responses = sent.map((s) => JSON.parse(s) as Record<string, unknown>);
      const forThisDoc = responses.filter((r) => r["docId"] === "doc-onsuccess-err");
      expect(forThisDoc).toHaveLength(1);
      expect(forThisDoc[0]?.["type"]).toBe("ChangeAccepted");
    });

    it("sends empty SubscribeResponse when all documents are denied", async () => {
      ctx.documentOwnership.set("doc-denied-1", brandId<SystemId>("sys_other"));
      ctx.documentOwnership.set("doc-denied-2", brandId<SystemId>("sys_other"));

      await routeMessage(
        JSON.stringify({
          type: "SubscribeRequest",
          correlationId: "550e8400-e29b-41d4-a716-446655440000",
          documents: [
            { docId: "doc-denied-1", lastSyncedSeq: 0, lastSnapshotVersion: 0 },
            { docId: "doc-denied-2", lastSyncedSeq: 0, lastSnapshotVersion: 0 },
          ],
        }),
        state,
        log,
        ctx,
      );

      const responses = sent.map((s) => JSON.parse(s) as Record<string, unknown>);
      const subscribeResp = responses.find((r) => r["type"] === "SubscribeResponse");
      expect(subscribeResp?.["correlationId"]).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(subscribeResp?.["catchup"]).toEqual([]);
    });
  });
});
