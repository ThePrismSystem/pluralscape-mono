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
  authRequest,
  lastResponse,
  makeChangePayload,
  makeMockLog,
  makeMockWs,
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

describe("message-router — rate limiting and access control basics", () => {
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

  describe("rate limiting", () => {
    beforeEach(async () => {
      await routeMessage(authRequest(), state, log, ctx);
      const refreshed = manager.get("conn-1");
      if (!refreshed) throw new Error("State not found after auth");
      state = refreshed;
      sent.length = 0;
    });

    it("returns RATE_LIMITED when read limit exceeded", async () => {
      // Exhaust the read rate limit (200 per window)
      state.readWindow.seed(200, 0, Date.now());

      await routeMessage(
        JSON.stringify({ type: "FetchSnapshotRequest", correlationId: null, docId: "doc-1" }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("RATE_LIMITED");
    });

    it("closes connection after repeated rate limit strikes", async () => {
      const localSent: string[] = [];
      const ws = makeMockWs(localSent);
      const strikeManager = new ConnectionManager();
      strikeManager.reserveUnauthSlot();
      const strikeStateInit = strikeManager.register("conn-strike", ws as never, Date.now());
      const strikeCtx = createRouterContext(1000, strikeManager);
      // Authenticate first
      await routeMessage(authRequest(), strikeStateInit, log, strikeCtx);
      const strikeState = strikeManager.get("conn-strike");
      if (!strikeState) throw new Error("State not found after auth");

      // Simulate many rate limit violations
      strikeState.readWindow.seed(200, 0, Date.now());
      strikeState.rateLimitStrikes = 9; // One more will hit the max (10)

      await routeMessage(
        JSON.stringify({ type: "FetchSnapshotRequest", correlationId: null, docId: "doc-1" }),
        strikeState,
        log,
        strikeCtx,
      );

      expect(ws.close).toHaveBeenCalled();
      strikeManager.closeAll(1001, "test cleanup");
    });

    it("decays strikes by 1 on successful message", async () => {
      state.rateLimitStrikes = 5;

      await routeMessage(
        JSON.stringify({ type: "FetchSnapshotRequest", correlationId: null, docId: "doc-1" }),
        state,
        log,
        ctx,
      );

      // Decays by 1, not reset to 0
      expect(state.rateLimitStrikes).toBe(4);
    });

    it("returns RATE_LIMITED when mutation limit exceeded", async () => {
      state.mutationWindow.seed(100, 0, Date.now());

      const change = makeChangePayload("doc-mut");
      await routeMessage(
        JSON.stringify({
          type: "SubmitChangeRequest",
          correlationId: null,
          docId: "doc-mut",
          change,
        }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("RATE_LIMITED");
    });

    it("preserves window offset on rotation", async () => {
      // Set the window start to a known past time
      const pastTime = Date.now() - 15_000; // 15s ago, more than one 10s window
      state.readWindow.seed(5, 0, pastTime);

      await routeMessage(
        JSON.stringify({ type: "FetchSnapshotRequest", correlationId: null, docId: "doc-1" }),
        state,
        log,
        ctx,
      );

      // After rotation, windowStart should be offset-corrected, not set to now
      expect(state.readWindow.snapshot().windowStart).toBeGreaterThan(pastTime);
    });
  });

  describe("document access control — basic", () => {
    beforeEach(async () => {
      await routeMessage(authRequest(), state, log, ctx);
      const refreshed = manager.get("conn-1");
      if (!refreshed) throw new Error("State not found after auth");
      state = refreshed;
      sent.length = 0;
    });

    it("allows first submit to any docId (creates ownership)", async () => {
      const change = makeChangePayload("doc-acl-1");
      await routeMessage(
        JSON.stringify({
          type: "SubmitChangeRequest",
          correlationId: null,
          docId: "doc-acl-1",
          change,
        }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("ChangeAccepted");
      expect(ctx.documentOwnership.get("doc-acl-1")).toBe("sys_test");
    });

    it("rejects submit to doc owned by another system", async () => {
      ctx.documentOwnership.set("doc-acl-2", brandId<SystemId>("sys_other"));

      const change = makeChangePayload("doc-acl-2");
      await routeMessage(
        JSON.stringify({
          type: "SubmitChangeRequest",
          correlationId: null,
          docId: "doc-acl-2",
          change,
        }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("PERMISSION_DENIED");
    });

    it("rejects read on doc owned by another system", async () => {
      ctx.documentOwnership.set("doc-acl-3", brandId<SystemId>("sys_other"));

      await routeMessage(
        JSON.stringify({ type: "FetchSnapshotRequest", correlationId: null, docId: "doc-acl-3" }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("PERMISSION_DENIED");
    });

    it("allows read on doc owned by same system", async () => {
      ctx.documentOwnership.set("doc-acl-4", brandId<SystemId>("sys_test"));

      await routeMessage(
        JSON.stringify({ type: "FetchSnapshotRequest", correlationId: null, docId: "doc-acl-4" }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SnapshotResponse");
    });

    it("allows read on unowned doc", async () => {
      await routeMessage(
        JSON.stringify({ type: "FetchSnapshotRequest", correlationId: null, docId: "doc-unowned" }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SnapshotResponse");
    });

    it("rejects DocumentLoadRequest on doc owned by another system", async () => {
      ctx.documentOwnership.set("doc-acl-5", brandId<SystemId>("sys_other"));

      await routeMessage(
        JSON.stringify({
          type: "DocumentLoadRequest",
          correlationId: null,
          docId: "doc-acl-5",
          persist: false,
        }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("PERMISSION_DENIED");
    });
  });

  describe("DB-backed document ownership (Sec-M1)", () => {
    beforeEach(async () => {
      await routeMessage(authRequest(), state, log, ctx);
      const refreshed = manager.get("conn-1");
      if (!refreshed) throw new Error("State not found after auth");
      state = refreshed;
      sent.length = 0;
    });

    afterEach(() => {
      mockDbLimit.mockReset();
      mockDbLimit.mockResolvedValue([]);
    });

    it("denies access when DB returns ownership by another system", async () => {
      mockDbLimit.mockResolvedValueOnce([{ systemId: "sys_other" }]);

      await routeMessage(
        JSON.stringify({ type: "FetchSnapshotRequest", correlationId: null, docId: "doc-db-1" }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("PERMISSION_DENIED");
    });

    it("allows access when DB returns ownership by same system", async () => {
      mockDbLimit.mockResolvedValueOnce([{ systemId: "sys_test" }]);

      await routeMessage(
        JSON.stringify({ type: "FetchSnapshotRequest", correlationId: null, docId: "doc-db-2" }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SnapshotResponse");
    });

    it("populates cache from DB result", async () => {
      mockDbLimit.mockResolvedValueOnce([{ systemId: "sys_other" }]);

      await routeMessage(
        JSON.stringify({ type: "FetchSnapshotRequest", correlationId: null, docId: "doc-db-3" }),
        state,
        log,
        ctx,
      );

      // Cache should now contain the ownership
      expect(ctx.documentOwnership.get("doc-db-3")).toBe("sys_other");
    });

    it("skips DB lookup when cache already has ownership", async () => {
      ctx.documentOwnership.set("doc-cached", brandId<SystemId>("sys_test"));
      mockDb.select.mockClear();

      await routeMessage(
        JSON.stringify({
          type: "FetchSnapshotRequest",
          correlationId: null,
          docId: "doc-cached",
        }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SnapshotResponse");
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it("fails open when DB query throws", async () => {
      mockDbLimit.mockRejectedValueOnce(new Error("DB connection lost"));

      await routeMessage(
        JSON.stringify({ type: "FetchSnapshotRequest", correlationId: null, docId: "doc-db-err" }),
        state,
        log,
        ctx,
      );

      // Should succeed (fail-open) since we can't confirm ownership
      const resp = lastResponse(sent);
      expect(resp["type"]).toBe("SnapshotResponse");
    });
  });
});
