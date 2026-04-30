import { initSodium } from "@pluralscape/crypto";
import { brandId } from "@pluralscape/types";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Envelope signature verification is unconditional. Mock data has invalid
// signatures, so we stub verifyEnvelopeSignature at module-mock time.
vi.mock("@pluralscape/sync", async () => {
  const actual = await vi.importActual<typeof import("@pluralscape/sync")>("@pluralscape/sync");
  return {
    ...actual,
    verifyEnvelopeSignature: vi.fn(() => true),
  };
});

import { ConnectionManager } from "../../ws/connection-manager.js";
import { createRouterContext, routeMessage } from "../../ws/message-router.js";

import { authRequest, lastResponse, makeMockLog, makeMockWs } from "./message-router-fixtures.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AppLogger } from "../../lib/logger.js";
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

describe("message-router — auth, dispatching, prototype pollution, send errors", () => {
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

  describe("awaiting-auth phase", () => {
    it("accepts AuthenticateRequest as first message", async () => {
      await routeMessage(authRequest(), state, log, ctx);

      // authenticate() creates a new object — check the manager's copy
      expect(manager.get("conn-1")?.phase).toBe("authenticated");
      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("AuthenticateResponse");
    });

    it("rejects non-AuthenticateRequest before auth", async () => {
      await routeMessage(
        JSON.stringify({ type: "ManifestRequest", correlationId: null, systemId: "sys_test" }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("AUTH_FAILED");
    });

    it("rejects invalid JSON", async () => {
      await routeMessage("not json {{{", state, log, ctx);

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("MALFORMED_MESSAGE");
    });

    it("rejects missing type field", async () => {
      await routeMessage(JSON.stringify({ correlationId: null }), state, log, ctx);

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("MALFORMED_MESSAGE");
    });

    it("rejects AuthenticateRequest with wrong protocol version", async () => {
      await routeMessage(
        JSON.stringify({
          type: "AuthenticateRequest",
          correlationId: null,
          protocolVersion: 999,
          sessionToken: "a".repeat(64),
          systemId: "sys_test",
          profileType: "owner-full",
        }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("MALFORMED_MESSAGE");
    });
  });

  describe("authenticated phase", () => {
    beforeEach(async () => {
      await routeMessage(authRequest(), state, log, ctx);
      // Re-fetch state — authenticate() creates a new object in the map
      const refreshed = manager.get("conn-1");
      if (!refreshed) throw new Error("State not found after auth");
      state = refreshed;
      sent.length = 0;
    });

    it("dispatches ManifestRequest to handler", async () => {
      await routeMessage(
        JSON.stringify({
          type: "ManifestRequest",
          correlationId: "550e8400-e29b-41d4-a716-446655440000",
          systemId: "sys_test",
        }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("ManifestResponse");
    });

    it("dispatches FetchSnapshotRequest to handler", async () => {
      await routeMessage(
        JSON.stringify({ type: "FetchSnapshotRequest", correlationId: null, docId: "doc-1" }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SnapshotResponse");
    });

    it("dispatches FetchChangesRequest to handler", async () => {
      await routeMessage(
        JSON.stringify({
          type: "FetchChangesRequest",
          correlationId: null,
          docId: "doc-1",
          sinceSeq: 0,
        }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("ChangesResponse");
    });

    it("dispatches SubscribeRequest to handler", async () => {
      await routeMessage(
        JSON.stringify({
          type: "SubscribeRequest",
          correlationId: null,
          documents: [{ docId: "doc-1", lastSyncedSeq: 0, lastSnapshotVersion: 0 }],
        }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SubscribeResponse");
    });

    it("dispatches UnsubscribeRequest (no response)", async () => {
      manager.addSubscription("conn-1", "doc-1");
      await routeMessage(
        JSON.stringify({ type: "UnsubscribeRequest", correlationId: null, docId: "doc-1" }),
        state,
        log,
        ctx,
      );

      // UnsubscribeRequest produces no response
      expect(sent).toHaveLength(0);
    });

    it("dispatches DocumentLoadRequest to handler", async () => {
      await routeMessage(
        JSON.stringify({
          type: "DocumentLoadRequest",
          correlationId: null,
          docId: "doc-1",
          persist: false,
        }),
        state,
        log,
        ctx,
      );

      // DocumentLoadRequest produces two responses
      expect(sent).toHaveLength(2);
      expect((JSON.parse(sent[0] ?? "{}") as Record<string, unknown>)["type"]).toBe(
        "SnapshotResponse",
      );
      expect((JSON.parse(sent[1] ?? "{}") as Record<string, unknown>)["type"]).toBe(
        "ChangesResponse",
      );
    });

    it("rejects unknown message type", async () => {
      await routeMessage(
        JSON.stringify({ type: "UnknownType", correlationId: null }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("MALFORMED_MESSAGE");
    });

    it("rejects second AuthenticateRequest", async () => {
      await routeMessage(authRequest(), state, log, ctx);

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("MALFORMED_MESSAGE");
    });

    it("rejects malformed schema", async () => {
      await routeMessage(
        JSON.stringify({
          type: "FetchChangesRequest",
          correlationId: null,
          docId: "doc-1",
          sinceSeq: "not-a-number",
        }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("MALFORMED_MESSAGE");
    });

    it("ManifestRequest rejects wrong systemId", async () => {
      await routeMessage(
        JSON.stringify({
          type: "ManifestRequest",
          correlationId: null,
          systemId: "sys_other",
        }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("PERMISSION_DENIED");
    });

    it("SubscribeRequest permits some docs and denies others", async () => {
      ctx.documentOwnership.set("doc-owned-by-other", brandId<SystemId>("sys_other"));

      await routeMessage(
        JSON.stringify({
          type: "SubscribeRequest",
          correlationId: null,
          documents: [
            { docId: "doc-ok", lastSyncedSeq: 0, lastSnapshotVersion: 0 },
            { docId: "doc-owned-by-other", lastSyncedSeq: 0, lastSnapshotVersion: 0 },
          ],
        }),
        state,
        log,
        ctx,
      );

      // Should get PERMISSION_DENIED for the denied doc and SubscribeResponse for permitted
      const responses = sent.map((s) => JSON.parse(s) as Record<string, unknown>);
      const denied = responses.find((r) => r["code"] === "PERMISSION_DENIED");
      const subscribed = responses.find((r) => r["type"] === "SubscribeResponse");
      expect(denied?.["code"]).toBe("PERMISSION_DENIED");
      expect(subscribed?.["type"]).toBe("SubscribeResponse");
    });

    it("does not echo user input in unknown message type error", async () => {
      await routeMessage(
        JSON.stringify({ type: "<script>alert(1)</script>", correlationId: null }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["message"]).toBe("Unknown message type");
      expect(String(resp["message"])).not.toContain("<script>");
    });
  });

  describe("send error logging", () => {
    it("logs warning when send fails", async () => {
      // Set up an authenticated connection with a broken ws.send
      const localSent: string[] = [];
      const brokenWs = makeMockWs(localSent);
      brokenWs.send.mockImplementation(() => {
        throw new Error("broken pipe");
      });
      const warnFn = vi.fn();
      const warnLog: AppLogger = {
        ...makeMockLog(),
        warn: warnFn,
      };
      const brokenManager = new ConnectionManager();
      brokenManager.reserveUnauthSlot();
      const brokenState = brokenManager.register("conn-broken", brokenWs as never, Date.now());
      const brokenCtx = createRouterContext(1000, brokenManager);

      // Authenticate first (this send will also fail but we need the state)
      await routeMessage(authRequest(), brokenState, warnLog, brokenCtx);

      // The send failure should have been logged
      expect(warnFn).toHaveBeenCalledWith(
        "WebSocket send failed",
        expect.objectContaining({
          connectionId: "conn-broken",
        }),
      );

      brokenManager.closeAll(1001, "test cleanup");
    });
  });

  describe("prototype pollution prevention", () => {
    beforeEach(async () => {
      await routeMessage(authRequest(), state, log, ctx);
      const refreshed = manager.get("conn-1");
      if (!refreshed) throw new Error("State not found after auth");
      state = refreshed;
      sent.length = 0;
    });

    it("rejects inherited prototype property as message type", async () => {
      await routeMessage(JSON.stringify({ type: "valueOf", correlationId: null }), state, log, ctx);

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("MALFORMED_MESSAGE");
    });

    it("rejects constructor as message type", async () => {
      await routeMessage(
        JSON.stringify({ type: "constructor", correlationId: null }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("MALFORMED_MESSAGE");
    });
  });
});
