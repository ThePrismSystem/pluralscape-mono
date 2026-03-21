import { initSodium } from "@pluralscape/crypto";
import { SYNC_PROTOCOL_VERSION } from "@pluralscape/sync";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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

/**
 * Chainable mock for `db.select().from().where().limit()`.
 * `mockDbLimit` is the terminal mock that controls the returned rows.
 */
const mockDbLimit = vi.fn().mockResolvedValue([]);
const mockDbChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: mockDbLimit,
};
const mockDb = { select: vi.fn().mockReturnValue(mockDbChain) };

vi.mock("../../lib/db.js", () => ({
  getDb: vi.fn().mockImplementation(() => Promise.resolve(mockDb)),
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

// Disable envelope signature verification for router tests (mock data has invalid signatures).
const savedEnvValue = process.env["VERIFY_ENVELOPE_SIGNATURES"];

// ── Tests ───────────────────────────────────────────────────────────

describe("message-router", () => {
  let manager: ConnectionManager;
  let state: SyncConnectionState;
  let ctx: RouterContext;
  const log = mockLog();

  beforeAll(async () => {
    await initSodium();
  });

  beforeEach(() => {
    process.env["VERIFY_ENVELOPE_SIGNATURES"] = "false";
    manager = new ConnectionManager();
    manager.reserveUnauthSlot();
    state = manager.register("conn-1", mockWs() as never, Date.now());
    ctx = createRouterContext(1000, manager);
    sent.length = 0;
  });

  afterEach(() => {
    if (savedEnvValue === undefined) {
      delete process.env["VERIFY_ENVELOPE_SIGNATURES"];
    } else {
      process.env["VERIFY_ENVELOPE_SIGNATURES"] = savedEnvValue;
    }
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
      expect(resp["message"]).toBe("Failed to process SubmitSnapshotRequest");
    });

    it("sends INTERNAL_ERROR when handleManifestRequest throws", async () => {
      const brokenRelay = {
        submit: vi.fn(),
        submitSnapshot: vi.fn(),
        getEnvelopesSince: vi.fn(),
        getLatestSnapshot: vi.fn(),
        getManifest: vi.fn(() => {
          throw new Error("manifest failure");
        }),
      };
      const brokenCtx: RouterContext = {
        relay: brokenRelay as never,
        documentOwnership: new Map<string, SystemId>(),
        manager,
      };

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

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("INTERNAL_ERROR");
      expect(resp["message"]).toBe("Failed to process manifest");
    });

    it("drops document and returns SubscribeResponse when catchup fetch fails", async () => {
      const brokenRelay = {
        submit: vi.fn(),
        submitSnapshot: vi.fn(),
        getEnvelopesSince: vi.fn(() => {
          throw new Error("subscribe failure");
        }),
        getLatestSnapshot: vi.fn(),
        getManifest: vi.fn(),
      };
      const brokenCtx: RouterContext = {
        relay: brokenRelay as never,
        documentOwnership: new Map<string, SystemId>(),
        manager,
      };

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

      const resp = lastResponse();
      expect(resp["type"]).toBe("SubscribeResponse");
      expect(resp["droppedDocIds"]).toContain("doc-sub-err");
    });

    it("sends INTERNAL_ERROR when handleSubmitChange throws", async () => {
      const brokenRelay = {
        submit: vi.fn(() => {
          throw new Error("change failure");
        }),
        submitSnapshot: vi.fn(),
        getEnvelopesSince: vi.fn(),
        getLatestSnapshot: vi.fn(),
        getManifest: vi.fn(),
      };
      const brokenCtx: RouterContext = {
        relay: brokenRelay as never,
        documentOwnership: new Map<string, SystemId>(),
        manager,
      };

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

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("INTERNAL_ERROR");
      expect(resp["message"]).toBe("Failed to process SubmitChangeRequest");
    });

    it("returns INVALID_ENVELOPE and skips broadcast when signature verification fails", async () => {
      process.env["VERIFY_ENVELOPE_SIGNATURES"] = "true";

      // Register a subscriber to verify no broadcast is sent
      manager.reserveUnauthSlot();
      const subWs = mockWs();
      manager.register("conn-sub", subWs as never, Date.now());
      manager.authenticate(
        "conn-sub",
        {
          accountId: "acct_test" as AccountId,
          systemId: "sys_sub" as SystemId,
          sessionId: "sess_sub" as SessionId,
          accountType: "system",
          ownedSystemIds: new Set(["sys_sub" as SystemId]),
        },
        "sys_sub" as SystemId,
        "owner-full",
      );
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

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("INVALID_ENVELOPE");

      // Subscriber should NOT have received a DocumentUpdate broadcast
      expect(subWs.send).not.toHaveBeenCalled();

      // Ownership should NOT have been set
      expect(ctx.documentOwnership.has("doc-sig-fail")).toBe(false);
    });

    it("sends INTERNAL_ERROR when handleDocumentLoad throws", async () => {
      const brokenRelay = {
        submit: vi.fn(),
        submitSnapshot: vi.fn(),
        getEnvelopesSince: vi.fn(),
        getLatestSnapshot: vi.fn(() => {
          throw new Error("load failure");
        }),
        getManifest: vi.fn(),
      };
      const brokenCtx: RouterContext = {
        relay: brokenRelay as never,
        documentOwnership: new Map<string, SystemId>(),
        manager,
      };

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

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("INTERNAL_ERROR");
      expect(resp["message"]).toBe("Failed to load document");
    });

    it("sends INTERNAL_ERROR when FetchSnapshotRequest handler throws via dispatchWithAccess", async () => {
      const brokenRelay = {
        submit: vi.fn(),
        submitSnapshot: vi.fn(),
        getEnvelopesSince: vi.fn(),
        getLatestSnapshot: vi.fn(() => {
          throw new Error("fetch failure");
        }),
        getManifest: vi.fn(),
      };
      const brokenCtx: RouterContext = {
        relay: brokenRelay as never,
        documentOwnership: new Map<string, SystemId>(),
        manager,
      };

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

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("INTERNAL_ERROR");
      expect(resp["message"]).toBe("Failed to process FetchSnapshotRequest");
    });

    it("sends INTERNAL_ERROR when FetchChangesRequest handler throws", async () => {
      const brokenRelay = {
        submit: vi.fn(),
        submitSnapshot: vi.fn(),
        getEnvelopesSince: vi.fn(() => {
          throw new Error("changes fetch failure");
        }),
        getLatestSnapshot: vi.fn(),
        getManifest: vi.fn(),
      };
      const brokenCtx: RouterContext = {
        relay: brokenRelay as never,
        documentOwnership: new Map<string, SystemId>(),
        manager,
      };

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

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("INTERNAL_ERROR");
      expect(resp["message"]).toBe("Failed to process FetchChangesRequest");
    });

    it("SubmitSnapshotRequest VERSION_CONFLICT does not set ownership", async () => {
      // First submit to establish version 2
      const snapshot1 = {
        ciphertext: base64urlOfLength(32, 1),
        nonce: base64urlOfLength(24, 2),
        signature: base64urlOfLength(64, 3),
        authorPublicKey: base64urlOfLength(32, 4),
        documentId: "doc-vc",
        snapshotVersion: 2,
      };
      await routeMessage(
        JSON.stringify({
          type: "SubmitSnapshotRequest",
          correlationId: null,
          docId: "doc-vc",
          snapshot: snapshot1,
        }),
        state,
        log,
        ctx,
      );
      sent.length = 0;
      ctx.documentOwnership.clear();

      // Now submit stale version 1 — should get VERSION_CONFLICT
      const snapshot2 = {
        ciphertext: base64urlOfLength(32, 5),
        nonce: base64urlOfLength(24, 6),
        signature: base64urlOfLength(64, 7),
        authorPublicKey: base64urlOfLength(32, 8),
        documentId: "doc-vc",
        snapshotVersion: 1,
      };
      await routeMessage(
        JSON.stringify({
          type: "SubmitSnapshotRequest",
          correlationId: null,
          docId: "doc-vc",
          snapshot: snapshot2,
        }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("VERSION_CONFLICT");
      // Ownership should NOT be set after a VERSION_CONFLICT
      expect(ctx.documentOwnership.has("doc-vc")).toBe(false);
    });

    it("ManifestRequest with broken ws does not crash", async () => {
      const brokenWs = mockWs();
      brokenWs.send.mockImplementation(() => {
        throw new Error("broken pipe");
      });
      const brokenManager = new ConnectionManager();
      brokenManager.reserveUnauthSlot();
      brokenManager.register("conn-broken-mfst", brokenWs as never, Date.now());
      brokenManager.authenticate(
        "conn-broken-mfst",
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
      const brokenState = brokenManager.get("conn-broken-mfst");
      if (!brokenState) throw new Error("State not found");
      const brokenCtx = createRouterContext(1000, brokenManager);

      await expect(
        routeMessage(
          JSON.stringify({
            type: "ManifestRequest",
            correlationId: null,
            systemId: "sys_test",
          }),
          brokenState,
          log,
          brokenCtx,
        ),
      ).resolves.not.toThrow();

      brokenManager.closeAll(1001, "test cleanup");
    });

    it("SubscribeRequest with broken ws does not crash", async () => {
      const brokenWs = mockWs();
      brokenWs.send.mockImplementation(() => {
        throw new Error("broken pipe");
      });
      const brokenManager = new ConnectionManager();
      brokenManager.reserveUnauthSlot();
      brokenManager.register("conn-broken-sub", brokenWs as never, Date.now());
      brokenManager.authenticate(
        "conn-broken-sub",
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
      const brokenState = brokenManager.get("conn-broken-sub");
      if (!brokenState) throw new Error("State not found");
      const brokenCtx = createRouterContext(1000, brokenManager);

      await expect(
        routeMessage(
          JSON.stringify({
            type: "SubscribeRequest",
            correlationId: null,
            documents: [{ docId: "doc-1", lastSyncedSeq: 0, lastSnapshotVersion: 0 }],
          }),
          brokenState,
          log,
          brokenCtx,
        ),
      ).resolves.not.toThrow();

      brokenManager.closeAll(1001, "test cleanup");
    });

    it("SubmitSnapshotRequest with broken ws does not crash", async () => {
      const brokenWs = mockWs();
      brokenWs.send.mockImplementation(() => {
        throw new Error("broken pipe");
      });
      const brokenManager = new ConnectionManager();
      brokenManager.reserveUnauthSlot();
      brokenManager.register("conn-broken-snap", brokenWs as never, Date.now());
      brokenManager.authenticate(
        "conn-broken-snap",
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
      const brokenState = brokenManager.get("conn-broken-snap");
      if (!brokenState) throw new Error("State not found");
      const brokenCtx = createRouterContext(1000, brokenManager);

      const snapshot = {
        ciphertext: base64urlOfLength(32, 1),
        nonce: base64urlOfLength(24, 2),
        signature: base64urlOfLength(64, 3),
        authorPublicKey: base64urlOfLength(32, 4),
        documentId: "doc-snap-broken",
        snapshotVersion: 1,
      };

      await expect(
        routeMessage(
          JSON.stringify({
            type: "SubmitSnapshotRequest",
            correlationId: null,
            docId: "doc-snap-broken",
            snapshot,
          }),
          brokenState,
          log,
          brokenCtx,
        ),
      ).resolves.not.toThrow();

      brokenManager.closeAll(1001, "test cleanup");
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

      const resp = lastResponse();
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

      const resp = lastResponse();
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
      ctx.documentOwnership.set("doc-cached", "sys_test" as SystemId);
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

      const resp = lastResponse();
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
      const resp = lastResponse();
      expect(resp["type"]).toBe("SnapshotResponse");
    });
  });
});
