import { SYNC_PROTOCOL_VERSION } from "@pluralscape/sync";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_LOGGER_BRAND } from "../../lib/logger.js";
import { ConnectionManager } from "../../ws/connection-manager.js";
import { createRouterContext, routeMessage } from "../../ws/message-router.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AppLogger } from "../../lib/logger.js";
import type { SyncConnectionState } from "../../ws/connection-state.js";
import type { RouterContext } from "../../ws/message-router.js";
import type { AccountId, SessionId, SystemId } from "@pluralscape/types";

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock("../../lib/session-auth.js", () => ({
  validateSession: vi.fn().mockResolvedValue({
    ok: true,
    auth: {
      accountId: "acct_test" as AccountId,
      systemId: "sys_test" as SystemId,
      sessionId: "sess_test" as SessionId,
      accountType: "system",
      ownedSystemIds: new Set(["sys_test" as SystemId]),
    } satisfies AuthContext,
    session: {},
  }),
}));

vi.mock("../../lib/db.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
}));

// ── Helpers ─────────────────────────────────────────────────────────

const sent: string[] = [];

function mockWs(): { close: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> } {
  return {
    close: vi.fn(),
    send: vi.fn((data: string) => {
      sent.push(data);
    }),
  };
}

function mockLog(): AppLogger {
  return {
    [APP_LOGGER_BRAND]: true as const,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

function lastResponse(): Record<string, unknown> {
  const last = sent[sent.length - 1];
  if (!last) throw new Error("No response sent");
  return JSON.parse(last) as Record<string, unknown>;
}

/** Generate a base64url string that decodes to exactly `n` bytes. */
function base64urlOfLength(n: number, fill = 0): string {
  return Buffer.from(new Uint8Array(n).fill(fill)).toString("base64url");
}

function makeChangePayload(docId: string): Record<string, string> {
  return {
    ciphertext: base64urlOfLength(32, 1),
    nonce: base64urlOfLength(24, 2), // AEAD_NONCE_BYTES = 24
    signature: base64urlOfLength(64, 3), // SIGN_BYTES = 64
    authorPublicKey: base64urlOfLength(32, 4), // SIGN_PUBLIC_KEY_BYTES = 32
    documentId: docId,
  };
}

function authRequest(): string {
  return JSON.stringify({
    type: "AuthenticateRequest",
    correlationId: null,
    protocolVersion: SYNC_PROTOCOL_VERSION,
    sessionToken: "a".repeat(64),
    systemId: "sys_test",
    profileType: "owner-full",
  });
}

// ── Tests ───────────────────────────────────────────────────────────

describe("message-router", () => {
  let manager: ConnectionManager;
  let state: SyncConnectionState;
  let ctx: RouterContext;
  const log = mockLog();

  beforeEach(() => {
    manager = new ConnectionManager();
    manager.reserveUnauthSlot();
    state = manager.register("conn-1", mockWs() as never, Date.now());
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
      const resp = lastResponse();
      expect(resp["type"]).toBe("AuthenticateResponse");
    });

    it("rejects non-AuthenticateRequest before auth", async () => {
      await routeMessage(
        JSON.stringify({ type: "ManifestRequest", correlationId: null, systemId: "sys_test" }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("AUTH_FAILED");
    });

    it("rejects invalid JSON", async () => {
      await routeMessage("not json {{{", state, log, ctx);

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("MALFORMED_MESSAGE");
    });

    it("rejects missing type field", async () => {
      await routeMessage(JSON.stringify({ correlationId: null }), state, log, ctx);

      const resp = lastResponse();
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

      const resp = lastResponse();
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

      const resp = lastResponse();
      expect(resp["type"]).toBe("ManifestResponse");
    });

    it("dispatches FetchSnapshotRequest to handler", async () => {
      await routeMessage(
        JSON.stringify({ type: "FetchSnapshotRequest", correlationId: null, docId: "doc-1" }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse();
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

      const resp = lastResponse();
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

      const resp = lastResponse();
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

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("MALFORMED_MESSAGE");
    });

    it("rejects second AuthenticateRequest", async () => {
      await routeMessage(authRequest(), state, log, ctx);

      const resp = lastResponse();
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

      const resp = lastResponse();
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

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("PERMISSION_DENIED");
    });

    it("SubscribeRequest permits some docs and denies others", async () => {
      ctx.documentOwnership.set("doc-owned-by-other", "sys_other" as SystemId);

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
      expect(denied).toBeDefined();
      expect(subscribed).toBeDefined();
    });

    it("does not echo user input in unknown message type error", async () => {
      await routeMessage(
        JSON.stringify({ type: "<script>alert(1)</script>", correlationId: null }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse();
      expect(resp["message"]).toBe("Unknown message type");
      expect(String(resp["message"])).not.toContain("<script>");
    });
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

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("RATE_LIMITED");
    });

    it("closes connection after repeated rate limit strikes", async () => {
      const ws = mockWs();
      const strikeManager = new ConnectionManager();
      strikeManager.reserveUnauthSlot();
      const strikeStateInit = strikeManager.register("conn-strike", ws as never, Date.now());
      const strikeCtx = createRouterContext(1000, strikeManager);
      // Authenticate first
      await routeMessage(authRequest(), strikeStateInit, log, strikeCtx);
      const strikeState = strikeManager.get("conn-strike");
      if (!strikeState) throw new Error("State not found after auth");
      sent.length = 0;

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

      const resp = lastResponse();
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

  describe("send error logging", () => {
    it("logs warning when send fails", async () => {
      // Set up an authenticated connection with a broken ws.send
      const brokenWs = mockWs();
      brokenWs.send.mockImplementation(() => {
        throw new Error("broken pipe");
      });
      const warnFn = vi.fn();
      const warnLog: AppLogger = {
        [APP_LOGGER_BRAND]: true as const,
        info: vi.fn(),
        warn: warnFn,
        error: vi.fn(),
        debug: vi.fn(),
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

      const resp = lastResponse();
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

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("MALFORMED_MESSAGE");
    });
  });

  describe("document access control", () => {
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

      const resp = lastResponse();
      expect(resp["type"]).toBe("ChangeAccepted");
      expect(ctx.documentOwnership.get("doc-acl-1")).toBe("sys_test");
    });

    it("rejects submit to doc owned by another system", async () => {
      ctx.documentOwnership.set("doc-acl-2", "sys_other" as SystemId);

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

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("PERMISSION_DENIED");
    });

    it("rejects read on doc owned by another system", async () => {
      ctx.documentOwnership.set("doc-acl-3", "sys_other" as SystemId);

      await routeMessage(
        JSON.stringify({ type: "FetchSnapshotRequest", correlationId: null, docId: "doc-acl-3" }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("PERMISSION_DENIED");
    });

    it("allows read on doc owned by same system", async () => {
      ctx.documentOwnership.set("doc-acl-4", "sys_test" as SystemId);

      await routeMessage(
        JSON.stringify({ type: "FetchSnapshotRequest", correlationId: null, docId: "doc-acl-4" }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse();
      expect(resp["type"]).toBe("SnapshotResponse");
    });

    it("allows read on unowned doc", async () => {
      await routeMessage(
        JSON.stringify({ type: "FetchSnapshotRequest", correlationId: null, docId: "doc-unowned" }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse();
      expect(resp["type"]).toBe("SnapshotResponse");
    });

    it("rejects DocumentLoadRequest on doc owned by another system", async () => {
      ctx.documentOwnership.set("doc-acl-5", "sys_other" as SystemId);

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

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("PERMISSION_DENIED");
    });

    it("SubmitChangeRequest skips broadcast on send failure", async () => {
      const brokenWs = mockWs();
      brokenWs.send.mockImplementation(() => {
        throw new Error("broken pipe");
      });
      const brokenManager = new ConnectionManager();
      brokenManager.reserveUnauthSlot();
      brokenManager.register("conn-broken", brokenWs as never, Date.now());
      brokenManager.authenticate(
        "conn-broken",
        {
          accountId: "acct_test" as AccountId,
          systemId: "sys_test" as SystemId,
          sessionId: "sess_test" as SessionId,
          accountType: "system",
          ownedSystemIds: new Set(["sys_test" as SystemId]),
        },
        "sys_test" as SystemId,
        "owner-full",
      );
      const brokenState = brokenManager.get("conn-broken");
      if (!brokenState) throw new Error("State not found");
      const brokenCtx = createRouterContext(1000, brokenManager);

      // Set up another subscriber to verify broadcast doesn't happen
      brokenManager.reserveUnauthSlot();
      const subWs = mockWs();
      brokenManager.register("conn-sub", subWs as never, Date.now());
      brokenManager.authenticate(
        "conn-sub",
        {
          accountId: "acct_test" as AccountId,
          systemId: "sys_test" as SystemId,
          sessionId: "sess_test" as SessionId,
          accountType: "system",
          ownedSystemIds: new Set(["sys_test" as SystemId]),
        },
        "sys_test" as SystemId,
        "owner-full",
      );
      brokenManager.addSubscription("conn-sub", "doc-bc");

      const change = makeChangePayload("doc-bc");
      await routeMessage(
        JSON.stringify({
          type: "SubmitChangeRequest",
          correlationId: null,
          docId: "doc-bc",
          change,
        }),
        brokenState,
        log,
        brokenCtx,
      );

      // Subscriber should NOT have received broadcast since send to submitter failed
      expect(subWs.send).not.toHaveBeenCalled();
      brokenManager.closeAll(1001, "test cleanup");
    });

    it("sends INTERNAL_ERROR when handleSubmitSnapshot throws unexpected error", async () => {
      // Submit a valid snapshot to establish a doc, then re-submit to trigger version conflict
      // which is handled. But we need an *unexpected* error. Use a broken relay.
      const brokenRelay = {
        submit: vi.fn(),
        submitSnapshot: vi.fn(() => {
          throw new Error("unexpected relay failure");
        }),
        getEnvelopesSince: vi.fn().mockReturnValue([]),
        getLatestSnapshot: vi.fn().mockReturnValue(null),
      };
      const brokenCtx: RouterContext = {
        relay: brokenRelay as never,
        documentOwnership: new Map<string, SystemId>(),
        manager,
      };

      const snapshot = {
        ciphertext: base64urlOfLength(32, 1),
        nonce: base64urlOfLength(24, 2),
        signature: base64urlOfLength(64, 3),
        authorPublicKey: base64urlOfLength(32, 4),
        documentId: "doc-snap-err",
        snapshotVersion: 1,
        lastSeq: 0,
      };

      await routeMessage(
        JSON.stringify({
          type: "SubmitSnapshotRequest",
          correlationId: "550e8400-e29b-41d4-a716-446655440000",
          docId: "doc-snap-err",
          snapshot,
        }),
        state,
        log,
        brokenCtx,
      );

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("INTERNAL_ERROR");
      expect(resp["message"]).toBe("Failed to process snapshot");
    });

    it("sends empty SubscribeResponse when all documents are denied", async () => {
      ctx.documentOwnership.set("doc-denied-1", "sys_other" as SystemId);
      ctx.documentOwnership.set("doc-denied-2", "sys_other" as SystemId);

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
      expect(subscribeResp).toBeDefined();
      expect(subscribeResp?.["correlationId"]).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(subscribeResp?.["catchup"]).toEqual([]);
    });
  });
});
