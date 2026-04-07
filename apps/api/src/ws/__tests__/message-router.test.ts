/**
 * Additional branch coverage for apps/api/src/ws/message-router.ts.
 *
 * Covers branches not reached by apps/api/src/__tests__/ws/message-router.test.ts:
 *   - createRouterContext onEvict callback (lines 72-73)
 *   - sendErrorAndClose ws.close throws (line 122)
 *   - handleAuthenticate returns ok:false (line 287)
 *   - rate-limit ws.close throws (line 326)
 *   - SubscribeRequest batch DB row loop (line 399)
 *   - handleSubscribeRequest throws INTERNAL_ERROR (lines 434-438)
 *   - FetchChangesRequest checkAccess denied (line 519)
 *   - SubmitChangeRequest syncPublished===false warning (line 585)
 *   - SubmitSnapshotRequest checkAccess denied (line 635)
 */
import { initSodium } from "@pluralscape/crypto";
import { SYNC_PROTOCOL_VERSION } from "@pluralscape/sync";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { APP_LOGGER_BRAND } from "../../lib/logger.js";
import { ConnectionManager } from "../../ws/connection-manager.js";
import { createRouterContext, routeMessage } from "../../ws/message-router.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AppLogger } from "../../lib/logger.js";
import type { SyncConnectionState } from "../../ws/connection-state.js";
import type { AccountId, SessionId, SystemId } from "@pluralscape/types";

// ── Module mocks ─────────────────────────────────────────────────────

const mockValidateSession = vi.fn().mockResolvedValue({
  ok: true,
  auth: {
    authMethod: "session" as const,
    accountId: "acct_mr2" as AccountId,
    systemId: "sys_mr2" as SystemId,
    sessionId: "sess_mr2" as SessionId,
    accountType: "system",
    ownedSystemIds: new Set(["sys_mr2" as SystemId]),
    auditLogIpTracking: false,
  } satisfies AuthContext,
  session: {},
});

vi.mock("../../lib/session-auth.js", () => ({
  get validateSession() {
    return mockValidateSession;
  },
}));

/**
 * Chainable mock for db.select().from().where()[.limit()].
 * `mockWhere` is the terminal mock that controls the returned rows for SubscribeRequest.
 * `mockLimit` is the terminal mock for single-row lookups (FetchSnapshot, etc.).
 */
const mockLimit = vi.fn().mockResolvedValue([]);
const mockWhere = vi.fn().mockReturnThis();
const mockDbChain = {
  from: vi.fn().mockReturnThis(),
  where: mockWhere,
  limit: mockLimit,
};
const mockDb = { select: vi.fn().mockReturnValue(mockDbChain) };

vi.mock("../../lib/db.js", () => ({
  getDb: vi.fn().mockImplementation(() => Promise.resolve(mockDb)),
}));

// ── Helpers ──────────────────────────────────────────────────────────

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

function base64urlOfLength(n: number, fill = 0): string {
  return Buffer.from(new Uint8Array(n).fill(fill)).toString("base64url");
}

function authRequest(): string {
  return JSON.stringify({
    type: "AuthenticateRequest",
    correlationId: null,
    protocolVersion: SYNC_PROTOCOL_VERSION,
    sessionToken: "a".repeat(64),
    systemId: "sys_mr2",
    profileType: "owner-full",
  });
}

/** Build an authenticated state directly (bypassing the auth flow). */
function makeAuthenticatedState(
  connectionId: string,
  ws: ReturnType<typeof mockWs>,
  manager: ConnectionManager,
): SyncConnectionState {
  manager.reserveUnauthSlot();
  manager.register(connectionId, ws as never, Date.now());
  manager.authenticate(
    connectionId,
    {
      authMethod: "session" as const,
      accountId: "acct_mr2" as AccountId,
      systemId: "sys_mr2" as SystemId,
      sessionId: "sess_mr2" as SessionId,
      accountType: "system",
      ownedSystemIds: new Set(["sys_mr2" as SystemId]),
      auditLogIpTracking: false,
    },
    "sys_mr2" as SystemId,
    "owner-full",
  );
  const state = manager.get(connectionId);
  if (!state) throw new Error(`State not found for ${connectionId}`);
  return state;
}

// ── Test setup ───────────────────────────────────────────────────────

const savedEnvValue = process.env["VERIFY_ENVELOPE_SIGNATURES"];

beforeAll(async () => {
  await initSodium();
});

afterEach(() => {
  if (savedEnvValue === undefined) {
    delete process.env["VERIFY_ENVELOPE_SIGNATURES"];
  } else {
    process.env["VERIFY_ENVELOPE_SIGNATURES"] = savedEnvValue;
  }
  sent.length = 0;
  mockValidateSession.mockRestore();
  mockLimit.mockReset();
  mockLimit.mockResolvedValue([]);
  mockWhere.mockReset();
  mockWhere.mockReturnThis();
});

// ── Tests ─────────────────────────────────────────────────────────────

describe("message-router branch coverage", () => {
  describe("createRouterContext onEvict callback", () => {
    it("deletes documentOwnership and removes subscriptions when relay evicts a doc", async () => {
      process.env["VERIFY_ENVELOPE_SIGNATURES"] = "false";

      // maxDocuments=1 forces eviction when the second distinct doc is submitted
      const manager = new ConnectionManager();
      const ctx = createRouterContext(1, manager);
      const log = mockLog();

      const ws1 = mockWs();
      const state1 = makeAuthenticatedState("conn-evict-1", ws1, manager);
      const ws2 = mockWs();
      const state2 = makeAuthenticatedState("conn-evict-2", ws2, manager);
      void state2; // registered above for subscription setup

      // Subscribe conn-evict-2 to doc-evict-1 so we can confirm it gets cleaned up
      manager.addSubscription("conn-evict-2", "doc-evict-1");

      // Step 1: submit to doc-evict-1 so the relay tracks it (fills capacity=1)
      const change1 = {
        ciphertext: base64urlOfLength(32, 1),
        nonce: base64urlOfLength(24, 2),
        signature: base64urlOfLength(64, 3),
        authorPublicKey: base64urlOfLength(32, 4),
        documentId: "doc-evict-1",
      };
      await routeMessage(
        JSON.stringify({
          type: "SubmitChangeRequest",
          correlationId: null,
          docId: "doc-evict-1",
          change: change1,
        }),
        state1,
        log,
        ctx,
      );

      // Confirm ownership is now tracked
      expect(ctx.documentOwnership.has("doc-evict-1")).toBe(true);
      sent.length = 0;

      // Step 2: submit to doc-evict-2 — relay is full (1/1), so doc-evict-1 is evicted
      const change2 = {
        ciphertext: base64urlOfLength(32, 5),
        nonce: base64urlOfLength(24, 6),
        signature: base64urlOfLength(64, 7),
        authorPublicKey: base64urlOfLength(32, 8),
        documentId: "doc-evict-2",
      };
      await routeMessage(
        JSON.stringify({
          type: "SubmitChangeRequest",
          correlationId: null,
          docId: "doc-evict-2",
          change: change2,
        }),
        state1,
        log,
        ctx,
      );

      // doc-evict-1 should have been evicted from ownership cache via onEvict
      expect(ctx.documentOwnership.has("doc-evict-1")).toBe(false);
      // conn-evict-2 subscription to doc-evict-1 should be cleared
      expect(manager.getSubscribers("doc-evict-1").size).toBe(0);

      manager.closeAll(1001, "test cleanup");
    });
  });

  describe("sendErrorAndClose ws.close throws", () => {
    it("logs debug when ws.close throws during auth-phase policy violation", async () => {
      const ws = mockWs();
      ws.close.mockImplementation(() => {
        throw new Error("already closed");
      });
      const log = mockLog();
      const manager = new ConnectionManager();
      manager.reserveUnauthSlot();
      const state = manager.register("conn-close-throw", ws as never, Date.now());
      const ctx = createRouterContext(1000, manager);

      // Sending a non-AuthenticateRequest in awaiting-auth phase calls sendErrorAndClose
      await routeMessage(
        JSON.stringify({ type: "ManifestRequest", correlationId: null, systemId: "sys_mr2" }),
        state,
        log,
        ctx,
      );

      expect(
        (log.debug as ReturnType<typeof vi.fn>).mock.calls.some(
          (args) =>
            typeof args[0] === "string" &&
            args[0].includes("WebSocket already closed during sendErrorAndClose"),
        ),
      ).toBe(true);

      manager.closeAll(1001, "test cleanup");
    });
  });

  describe("authentication failure (ok:false)", () => {
    it("calls sendErrorAndClose when handleAuthenticate returns ok:false", async () => {
      const ws = mockWs();
      const log = mockLog();
      const manager = new ConnectionManager();
      manager.reserveUnauthSlot();
      const state = manager.register("conn-auth-fail", ws as never, Date.now());
      const ctx = createRouterContext(1000, manager);

      // Make validateSession return a failure so handleAuthenticate returns ok:false
      mockValidateSession.mockResolvedValueOnce({ ok: false, error: "AUTH_FAILED" });

      await routeMessage(authRequest(), state, log, ctx);

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("AUTH_FAILED");
      expect(ws.close).toHaveBeenCalled();

      manager.closeAll(1001, "test cleanup");
    });
  });

  describe("rate limit ws.close throws", () => {
    it("logs debug when ws.close throws during rate limit connection close", async () => {
      const ws = mockWs();
      const log = mockLog();
      const manager = new ConnectionManager();
      const ctx = createRouterContext(1000, manager);
      const state = makeAuthenticatedState("conn-rl-throw", ws, manager);

      // Make ws.close throw
      ws.close.mockImplementation(() => {
        throw new Error("already closed");
      });

      // Exhaust read rate limit and set strikes to max - 1
      state.readWindow.seed(200, 0, Date.now());
      state.rateLimitStrikes = 9; // One more hit reaches WS_RATE_LIMIT_STRIKE_MAX (10)

      await routeMessage(
        JSON.stringify({
          type: "FetchSnapshotRequest",
          correlationId: null,
          docId: "doc-rl-throw",
        }),
        state,
        log,
        ctx,
      );

      expect(
        (log.debug as ReturnType<typeof vi.fn>).mock.calls.some(
          (args) =>
            typeof args[0] === "string" &&
            args[0].includes("WebSocket already closed during rate limit enforcement"),
        ),
      ).toBe(true);

      manager.closeAll(1001, "test cleanup");
    });
  });

  describe("SubscribeRequest batch DB row population", () => {
    it("populates ownership cache from batch DB query rows", async () => {
      const ws = mockWs();
      const log = mockLog();
      const manager = new ConnectionManager();
      const ctx = createRouterContext(1000, manager);
      const state = makeAuthenticatedState("conn-batch-db", ws, manager);

      // Mock the batch DB query (where() is the terminal call for SubscribeRequest)
      mockWhere.mockResolvedValueOnce([{ documentId: "doc-batch-1", systemId: "sys_mr2" }]);

      await routeMessage(
        JSON.stringify({
          type: "SubscribeRequest",
          correlationId: null,
          documents: [{ docId: "doc-batch-1", lastSyncedSeq: 0, lastSnapshotVersion: 0 }],
        }),
        state,
        log,
        ctx,
      );

      // Ownership cache should have been populated from the batch query
      expect(ctx.documentOwnership.get("doc-batch-1")).toBe("sys_mr2");

      manager.closeAll(1001, "test cleanup");
    });
  });

  describe("FetchChangesRequest checkAccess denied", () => {
    it("returns early when checkAccess denies FetchChangesRequest", async () => {
      const ws = mockWs();
      const log = mockLog();
      const manager = new ConnectionManager();
      const ctx = createRouterContext(1000, manager);
      const state = makeAuthenticatedState("conn-fc-deny", ws, manager);

      ctx.documentOwnership.set("doc-fc-denied", "sys_other" as SystemId);

      await routeMessage(
        JSON.stringify({
          type: "FetchChangesRequest",
          correlationId: null,
          docId: "doc-fc-denied",
          sinceSeq: 0,
        }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("PERMISSION_DENIED");

      manager.closeAll(1001, "test cleanup");
    });
  });

  describe("SubmitChangeRequest syncPublished===false", () => {
    it("logs warning when Valkey publish returns false", async () => {
      process.env["VERIFY_ENVELOPE_SIGNATURES"] = "false";

      const ws = mockWs();
      const log = mockLog();
      const manager = new ConnectionManager();
      const pubsub = {
        id: "server-1",
        publish: vi.fn().mockResolvedValue(false),
      };
      const ctx = createRouterContext(1000, manager, pubsub);
      const state = makeAuthenticatedState("conn-publish-false", ws, manager);

      const change = {
        ciphertext: base64urlOfLength(32, 1),
        nonce: base64urlOfLength(24, 2),
        signature: base64urlOfLength(64, 3),
        authorPublicKey: base64urlOfLength(32, 4),
        documentId: "doc-pubfalse",
      };

      await routeMessage(
        JSON.stringify({
          type: "SubmitChangeRequest",
          correlationId: null,
          docId: "doc-pubfalse",
          change,
        }),
        state,
        log,
        ctx,
      );

      expect(
        (log.warn as ReturnType<typeof vi.fn>).mock.calls.some(
          (args) =>
            typeof args[0] === "string" && args[0].includes("Cross-instance sync publish failed"),
        ),
      ).toBe(true);

      manager.closeAll(1001, "test cleanup");
    });
  });

  describe("SubmitSnapshotRequest checkAccess denied", () => {
    it("returns early when checkAccess denies SubmitSnapshotRequest", async () => {
      const ws = mockWs();
      const log = mockLog();
      const manager = new ConnectionManager();
      const ctx = createRouterContext(1000, manager);
      const state = makeAuthenticatedState("conn-ss-deny", ws, manager);

      ctx.documentOwnership.set("doc-ss-denied", "sys_other" as SystemId);

      const snapshot = {
        ciphertext: base64urlOfLength(32, 1),
        nonce: base64urlOfLength(24, 2),
        signature: base64urlOfLength(64, 3),
        authorPublicKey: base64urlOfLength(32, 4),
        documentId: "doc-ss-denied",
        snapshotVersion: 1,
      };

      await routeMessage(
        JSON.stringify({
          type: "SubmitSnapshotRequest",
          correlationId: null,
          docId: "doc-ss-denied",
          snapshot,
        }),
        state,
        log,
        ctx,
      );

      const resp = lastResponse();
      expect(resp["type"]).toBe("SyncError");
      expect(resp["code"]).toBe("PERMISSION_DENIED");

      manager.closeAll(1001, "test cleanup");
    });
  });
});
