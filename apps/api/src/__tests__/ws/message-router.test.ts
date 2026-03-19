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
    ctx = createRouterContext(1000);
    sent.length = 0;
  });

  afterEach(() => {
    manager.closeAll(1001, "test cleanup");
    ctx.documentOwnership.clear();
  });

  describe("awaiting-auth phase", () => {
    it("accepts AuthenticateRequest as first message", async () => {
      await routeMessage(authRequest(), state, manager, log, ctx);

      // authenticate() creates a new object — check the manager's copy
      expect(manager.get("conn-1")?.phase).toBe("authenticated");
      const resp = lastResponse();
      expect(resp["type"]).toBe("AuthenticateResponse");
    });

    it("rejects non-AuthenticateRequest before auth", async () => {
      await routeMessage(
        JSON.stringify({ type: "ManifestRequest", correlationId: null, systemId: "sys_test" }),
        state,
        manager,
        log,
        ctx,
      );

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("AUTH_FAILED");
    });

    it("rejects invalid JSON", async () => {
      await routeMessage("not json {{{", state, manager, log, ctx);

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("MALFORMED_MESSAGE");
    });

    it("rejects missing type field", async () => {
      await routeMessage(JSON.stringify({ correlationId: null }), state, manager, log, ctx);

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
        manager,
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
      await routeMessage(authRequest(), state, manager, log, ctx);
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
        manager,
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
        manager,
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
        manager,
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
        manager,
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
        manager,
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
        manager,
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
        manager,
        log,
        ctx,
      );

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("MALFORMED_MESSAGE");
    });

    it("rejects second AuthenticateRequest", async () => {
      await routeMessage(authRequest(), state, manager, log, ctx);

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
        manager,
        log,
        ctx,
      );

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("MALFORMED_MESSAGE");
    });
  });

  describe("closing phase", () => {
    it("silently discards messages in closing phase", async () => {
      // Create a state object in the closing phase
      const closingState: SyncConnectionState = {
        connectionId: state.connectionId,
        ws: state.ws,
        connectedAt: state.connectedAt,
        phase: "closing",
        auth: null,
        systemId: null,
        profileType: null,
        subscribedDocs: new Set(),
        mutationCount: 0,
        mutationWindowStart: 0,
        mutationPreviousCount: 0,
        readCount: 0,
        readWindowStart: 0,
        readPreviousCount: 0,
        rateLimitStrikes: 0,
        authTimeoutHandle: null,
      };
      await routeMessage(authRequest(), closingState, manager, log, ctx);
      expect(sent).toHaveLength(0);
    });
  });

  describe("rate limiting", () => {
    beforeEach(async () => {
      await routeMessage(authRequest(), state, manager, log, ctx);
      const refreshed = manager.get("conn-1");
      if (!refreshed) throw new Error("State not found after auth");
      state = refreshed;
      sent.length = 0;
    });

    it("returns RATE_LIMITED when read limit exceeded", async () => {
      // Exhaust the read rate limit (200 per window)
      state.readCount = 200;
      state.readWindowStart = Date.now();

      await routeMessage(
        JSON.stringify({ type: "FetchSnapshotRequest", correlationId: null, docId: "doc-1" }),
        state,
        manager,
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
      // Authenticate first
      await routeMessage(authRequest(), strikeStateInit, strikeManager, log, ctx);
      const strikeState = strikeManager.get("conn-strike");
      if (!strikeState) throw new Error("State not found after auth");
      sent.length = 0;

      // Simulate many rate limit violations
      strikeState.readCount = 200;
      strikeState.readWindowStart = Date.now();
      strikeState.rateLimitStrikes = 9; // One more will hit the max (10)

      await routeMessage(
        JSON.stringify({ type: "FetchSnapshotRequest", correlationId: null, docId: "doc-1" }),
        strikeState,
        strikeManager,
        log,
        ctx,
      );

      expect(ws.close).toHaveBeenCalled();
      strikeManager.closeAll(1001, "test cleanup");
    });

    it("resets strikes on successful message", async () => {
      state.rateLimitStrikes = 5;

      await routeMessage(
        JSON.stringify({ type: "FetchSnapshotRequest", correlationId: null, docId: "doc-1" }),
        state,
        manager,
        log,
        ctx,
      );

      expect(state.rateLimitStrikes).toBe(0);
    });

    it("returns RATE_LIMITED when mutation limit exceeded", async () => {
      state.mutationCount = 100;
      state.mutationWindowStart = Date.now();

      const change = {
        ciphertext: Buffer.from("test").toString("base64url"),
        nonce: Buffer.from("nonce123456789012345678").toString("base64url"),
        signature: Buffer.from("sig".repeat(22)).toString("base64url"),
        authorPublicKey: Buffer.from("key".repeat(11)).toString("base64url"),
        documentId: "doc-mut",
      };
      await routeMessage(
        JSON.stringify({
          type: "SubmitChangeRequest",
          correlationId: null,
          docId: "doc-mut",
          change,
        }),
        state,
        manager,
        log,
        ctx,
      );

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("RATE_LIMITED");
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

      // Authenticate first (this send will also fail but we need the state)
      await routeMessage(authRequest(), brokenState, brokenManager, warnLog, ctx);

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
      await routeMessage(authRequest(), state, manager, log, ctx);
      const refreshed = manager.get("conn-1");
      if (!refreshed) throw new Error("State not found after auth");
      state = refreshed;
      sent.length = 0;
    });

    it("rejects inherited prototype property as message type", async () => {
      await routeMessage(
        JSON.stringify({ type: "valueOf", correlationId: null }),
        state,
        manager,
        log,
        ctx,
      );

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("MALFORMED_MESSAGE");
      expect(resp["message"]).toContain("Unknown message type");
    });

    it("rejects constructor as message type", async () => {
      await routeMessage(
        JSON.stringify({ type: "constructor", correlationId: null }),
        state,
        manager,
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
      await routeMessage(authRequest(), state, manager, log, ctx);
      const refreshed = manager.get("conn-1");
      if (!refreshed) throw new Error("State not found after auth");
      state = refreshed;
      sent.length = 0;
    });

    it("allows first submit to any docId (creates ownership)", async () => {
      const change = {
        ciphertext: Buffer.from("test").toString("base64url"),
        nonce: Buffer.from("nonce123456789012345678").toString("base64url"),
        signature: Buffer.from("sig".repeat(22)).toString("base64url"),
        authorPublicKey: Buffer.from("key".repeat(11)).toString("base64url"),
        documentId: "doc-acl-1",
      };
      await routeMessage(
        JSON.stringify({
          type: "SubmitChangeRequest",
          correlationId: null,
          docId: "doc-acl-1",
          change,
        }),
        state,
        manager,
        log,
        ctx,
      );

      const resp = lastResponse();
      expect(resp["type"]).toBe("ChangeAccepted");
      expect(ctx.documentOwnership.get("doc-acl-1")).toBe("sys_test");
    });

    it("rejects submit to doc owned by another system", async () => {
      ctx.documentOwnership.set("doc-acl-2", "sys_other");

      const change = {
        ciphertext: Buffer.from("test").toString("base64url"),
        nonce: Buffer.from("nonce123456789012345678").toString("base64url"),
        signature: Buffer.from("sig".repeat(22)).toString("base64url"),
        authorPublicKey: Buffer.from("key".repeat(11)).toString("base64url"),
        documentId: "doc-acl-2",
      };
      await routeMessage(
        JSON.stringify({
          type: "SubmitChangeRequest",
          correlationId: null,
          docId: "doc-acl-2",
          change,
        }),
        state,
        manager,
        log,
        ctx,
      );

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("PERMISSION_DENIED");
    });

    it("rejects read on doc owned by another system", async () => {
      ctx.documentOwnership.set("doc-acl-3", "sys_other");

      await routeMessage(
        JSON.stringify({ type: "FetchSnapshotRequest", correlationId: null, docId: "doc-acl-3" }),
        state,
        manager,
        log,
        ctx,
      );

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("PERMISSION_DENIED");
    });

    it("allows read on doc owned by same system", async () => {
      ctx.documentOwnership.set("doc-acl-4", "sys_test");

      await routeMessage(
        JSON.stringify({ type: "FetchSnapshotRequest", correlationId: null, docId: "doc-acl-4" }),
        state,
        manager,
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
        manager,
        log,
        ctx,
      );

      const resp = lastResponse();
      expect(resp["type"]).toBe("SnapshotResponse");
    });

    it("rejects DocumentLoadRequest on doc owned by another system", async () => {
      ctx.documentOwnership.set("doc-acl-5", "sys_other");

      await routeMessage(
        JSON.stringify({
          type: "DocumentLoadRequest",
          correlationId: null,
          docId: "doc-acl-5",
          persist: false,
        }),
        state,
        manager,
        log,
        ctx,
      );

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("PERMISSION_DENIED");
    });
  });
});
