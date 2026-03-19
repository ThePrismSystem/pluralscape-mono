import { SYNC_PROTOCOL_VERSION } from "@pluralscape/sync";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_LOGGER_BRAND } from "../../lib/logger.js";
import { handleAuthenticate } from "../../ws/auth-handler.js";
import { ConnectionManager } from "../../ws/connection-manager.js";
import { WS_CLOSE_POLICY_VIOLATION } from "../../ws/ws.constants.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AppLogger } from "../../lib/logger.js";
import type { ValidateSessionResult } from "../../lib/session-auth.js";
import type { AuthenticateRequest } from "@pluralscape/sync";
import type { AccountId, SessionId, SystemId } from "@pluralscape/types";

// ── Mocks ───────────────────────────────────────────────────────────

const mockValidateSession = vi.fn<() => Promise<ValidateSessionResult>>();
const mockGetDb = vi.fn<() => Promise<unknown>>().mockResolvedValue({});

vi.mock("../../lib/session-auth.js", () => ({
  validateSession: (): Promise<ValidateSessionResult> => mockValidateSession(),
}));

vi.mock("../../lib/db.js", () => ({
  getDb: (): Promise<unknown> => mockGetDb(),
}));

// ── Helpers ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_550e8400-e29b-41d4-a716-446655440000" as SystemId;
const ACCOUNT_ID = "acct_test" as AccountId;

function mockWs(): { close: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> } {
  return { close: vi.fn(), send: vi.fn() };
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

function validAuth(): AuthContext {
  return {
    accountId: ACCOUNT_ID,
    systemId: SYSTEM_ID,
    sessionId: "sess_test" as SessionId,
    accountType: "system",
    ownedSystemIds: new Set([SYSTEM_ID]),
  };
}

function validRequest(overrides?: Partial<AuthenticateRequest>): AuthenticateRequest {
  return {
    type: "AuthenticateRequest",
    correlationId: "corr-1",
    protocolVersion: SYNC_PROTOCOL_VERSION,
    sessionToken: "a".repeat(64),
    systemId: SYSTEM_ID,
    profileType: "owner-full",
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("handleAuthenticate", () => {
  let manager: ConnectionManager;
  const log = mockLog();

  beforeEach(() => {
    manager = new ConnectionManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    manager.closeAll(1001, "test cleanup");
  });

  it("succeeds with valid token and protocol version", async () => {
    const auth = validAuth();
    mockValidateSession.mockResolvedValue({ ok: true, auth, session: {} as never });
    manager.reserveUnauthSlot();
    const state = manager.register("conn-1", mockWs() as never, Date.now());
    state.authTimeoutHandle = setTimeout(() => {}, 10_000);

    const result = await handleAuthenticate(validRequest(), state, manager, log);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.type).toBe("AuthenticateResponse");
      expect(result.response.syncSessionId).toBe("conn-1");
      expect(typeof result.response.serverTime).toBe("number");
    }
    expect(manager.get("conn-1")?.phase).toBe("authenticated");
    // Auth timeout is cleared by manager.authenticate()
    expect(manager.get("conn-1")?.authTimeoutHandle).toBeNull();
  });

  it("returns AUTH_FAILED for invalid token", async () => {
    mockValidateSession.mockResolvedValue({ ok: false, error: "UNAUTHENTICATED" });
    manager.reserveUnauthSlot();
    const state = manager.register("conn-1", mockWs() as never, Date.now());

    const result = await handleAuthenticate(validRequest(), state, manager, log);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTH_FAILED");
      expect(result.closeCode).toBe(WS_CLOSE_POLICY_VIOLATION);
    }
  });

  it("returns AUTH_EXPIRED for expired session", async () => {
    mockValidateSession.mockResolvedValue({ ok: false, error: "SESSION_EXPIRED" });
    manager.reserveUnauthSlot();
    const state = manager.register("conn-1", mockWs() as never, Date.now());

    const result = await handleAuthenticate(validRequest(), state, manager, log);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTH_EXPIRED");
    }
  });

  it("returns PERMISSION_DENIED when systemId not owned", async () => {
    const auth: AuthContext = {
      ...validAuth(),
      ownedSystemIds: new Set<SystemId>(),
    };
    mockValidateSession.mockResolvedValue({ ok: true, auth, session: {} as never });
    manager.reserveUnauthSlot();
    const state = manager.register("conn-1", mockWs() as never, Date.now());

    const result = await handleAuthenticate(validRequest(), state, manager, log);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PERMISSION_DENIED");
    }
  });

  it("requires system ownership even for friend profile", async () => {
    const auth: AuthContext = {
      ...validAuth(),
      ownedSystemIds: new Set<SystemId>(),
    };
    mockValidateSession.mockResolvedValue({ ok: true, auth, session: {} as never });
    manager.reserveUnauthSlot();
    const state = manager.register("conn-1", mockWs() as never, Date.now());

    const result = await handleAuthenticate(
      validRequest({ profileType: "friend" }),
      state,
      manager,
      log,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PERMISSION_DENIED");
    }
  });

  it("friend profile succeeds when system is owned", async () => {
    const auth = validAuth();
    mockValidateSession.mockResolvedValue({ ok: true, auth, session: {} as never });
    manager.reserveUnauthSlot();
    const state = manager.register("conn-1", mockWs() as never, Date.now());

    const result = await handleAuthenticate(
      validRequest({ profileType: "friend" }),
      state,
      manager,
      log,
    );

    expect(result.ok).toBe(true);
  });

  it("returns RATE_LIMITED when per-account connection limit exceeded", async () => {
    const auth = validAuth();
    mockValidateSession.mockResolvedValue({ ok: true, auth, session: {} as never });

    // Fill up account connections to the limit
    for (let i = 0; i < 10; i++) {
      const id = `existing-${String(i)}`;
      manager.reserveUnauthSlot();
      manager.register(id, mockWs() as never, Date.now());
      manager.authenticate(id, auth, SYSTEM_ID, "owner-full");
    }

    manager.reserveUnauthSlot();
    const state = manager.register("conn-new", mockWs() as never, Date.now());
    const result = await handleAuthenticate(validRequest(), state, manager, log);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("RATE_LIMITED");
    }
  });

  it("clears auth timeout on success", async () => {
    mockValidateSession.mockResolvedValue({ ok: true, auth: validAuth(), session: {} as never });
    manager.reserveUnauthSlot();
    const state = manager.register("conn-1", mockWs() as never, Date.now());
    state.authTimeoutHandle = setTimeout(() => {}, 10_000);

    await handleAuthenticate(validRequest(), state, manager, log);

    // Auth timeout is cleared by manager.authenticate() — check the new state in the map
    const updated = manager.get("conn-1");
    expect(updated?.authTimeoutHandle).toBeNull();
  });

  it("returns AUTH_FAILED when connection removed during auth", async () => {
    mockValidateSession.mockResolvedValue({ ok: true, auth: validAuth(), session: {} as never });
    manager.reserveUnauthSlot();
    const state = manager.register("conn-1", mockWs() as never, Date.now());
    // Simulate connection removal during async auth
    manager.remove("conn-1");

    const result = await handleAuthenticate(validRequest(), state, manager, log);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTH_FAILED");
    }
  });

  it("preserves correlationId in response", async () => {
    mockValidateSession.mockResolvedValue({ ok: true, auth: validAuth(), session: {} as never });
    manager.reserveUnauthSlot();
    const state = manager.register("conn-1", mockWs() as never, Date.now());

    const result = await handleAuthenticate(
      validRequest({ correlationId: "my-corr-id" }),
      state,
      manager,
      log,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.correlationId).toBe("my-corr-id");
    }
  });

  it("returns AUTH_FAILED when getDb throws", async () => {
    mockGetDb.mockRejectedValueOnce(new Error("DB connection failed"));
    manager.reserveUnauthSlot();
    const state = manager.register("conn-1", mockWs() as never, Date.now());

    const result = await handleAuthenticate(validRequest(), state, manager, log);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTH_FAILED");
      expect(result.error.message).toBe("Authentication service unavailable");
    }
  });

  it("returns AUTH_FAILED when validateSession throws", async () => {
    mockValidateSession.mockRejectedValueOnce(new Error("session service down"));
    manager.reserveUnauthSlot();
    const state = manager.register("conn-1", mockWs() as never, Date.now());

    const result = await handleAuthenticate(validRequest(), state, manager, log);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTH_FAILED");
      expect(result.error.message).toBe("Authentication service unavailable");
    }
  });
});
