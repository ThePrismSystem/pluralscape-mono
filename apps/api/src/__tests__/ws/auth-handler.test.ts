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

type AuthContextWithSystem = AuthContext & { readonly systemId: SystemId };

function validAuth(): AuthContextWithSystem {
  const systemId = crypto.randomUUID() as SystemId;
  return {
    accountId: crypto.randomUUID() as AccountId,
    systemId,
    sessionId: crypto.randomUUID() as SessionId,
    accountType: "system",
    ownedSystemIds: new Set([systemId]),
    auditLogIpTracking: false,
  };
}

function validRequest(
  systemId: SystemId,
  overrides?: Partial<AuthenticateRequest>,
): AuthenticateRequest {
  return {
    type: "AuthenticateRequest",
    correlationId: "corr-1",
    protocolVersion: SYNC_PROTOCOL_VERSION,
    sessionToken: "a".repeat(64),
    systemId,
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

    const result = await handleAuthenticate(validRequest(auth.systemId), state, manager, log);

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
    const systemId = crypto.randomUUID() as SystemId;
    mockValidateSession.mockResolvedValue({ ok: false, error: "UNAUTHENTICATED" });
    manager.reserveUnauthSlot();
    const state = manager.register("conn-1", mockWs() as never, Date.now());

    const result = await handleAuthenticate(validRequest(systemId), state, manager, log);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTH_FAILED");
      expect(result.closeCode).toBe(WS_CLOSE_POLICY_VIOLATION);
    }
  });

  it("returns AUTH_EXPIRED for expired session", async () => {
    const systemId = crypto.randomUUID() as SystemId;
    mockValidateSession.mockResolvedValue({ ok: false, error: "SESSION_EXPIRED" });
    manager.reserveUnauthSlot();
    const state = manager.register("conn-1", mockWs() as never, Date.now());

    const result = await handleAuthenticate(validRequest(systemId), state, manager, log);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTH_EXPIRED");
    }
  });

  it("returns PERMISSION_DENIED when systemId not owned", async () => {
    const auth: AuthContextWithSystem = {
      ...validAuth(),
      ownedSystemIds: new Set<SystemId>(),
      auditLogIpTracking: false,
    };
    mockValidateSession.mockResolvedValue({ ok: true, auth, session: {} as never });
    manager.reserveUnauthSlot();
    const state = manager.register("conn-1", mockWs() as never, Date.now());

    const result = await handleAuthenticate(validRequest(auth.systemId), state, manager, log);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PERMISSION_DENIED");
    }
  });

  it("requires system ownership even for friend profile", async () => {
    const auth: AuthContextWithSystem = {
      ...validAuth(),
      ownedSystemIds: new Set<SystemId>(),
      auditLogIpTracking: false,
    };
    mockValidateSession.mockResolvedValue({ ok: true, auth, session: {} as never });
    manager.reserveUnauthSlot();
    const state = manager.register("conn-1", mockWs() as never, Date.now());

    const result = await handleAuthenticate(
      validRequest(auth.systemId, { profileType: "friend" }),
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
      validRequest(auth.systemId, { profileType: "friend" }),
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
      manager.authenticate(id, auth, auth.systemId, "owner-full");
    }

    manager.reserveUnauthSlot();
    const state = manager.register("conn-new", mockWs() as never, Date.now());
    const result = await handleAuthenticate(validRequest(auth.systemId), state, manager, log);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("RATE_LIMITED");
    }
  });

  it("clears auth timeout on success", async () => {
    const auth = validAuth();
    mockValidateSession.mockResolvedValue({ ok: true, auth, session: {} as never });
    manager.reserveUnauthSlot();
    const state = manager.register("conn-1", mockWs() as never, Date.now());
    state.authTimeoutHandle = setTimeout(() => {}, 10_000);

    await handleAuthenticate(validRequest(auth.systemId), state, manager, log);

    // Auth timeout is cleared by manager.authenticate() -- check the new state in the map
    const updated = manager.get("conn-1");
    expect(updated?.authTimeoutHandle).toBeNull();
  });

  it("returns AUTH_FAILED when connection removed during auth", async () => {
    const auth = validAuth();
    mockValidateSession.mockResolvedValue({ ok: true, auth, session: {} as never });
    manager.reserveUnauthSlot();
    const state = manager.register("conn-1", mockWs() as never, Date.now());
    // Simulate connection removal during async auth
    manager.remove("conn-1");

    const result = await handleAuthenticate(validRequest(auth.systemId), state, manager, log);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTH_FAILED");
    }
  });

  it("preserves correlationId in response", async () => {
    const auth = validAuth();
    mockValidateSession.mockResolvedValue({ ok: true, auth, session: {} as never });
    manager.reserveUnauthSlot();
    const state = manager.register("conn-1", mockWs() as never, Date.now());

    const result = await handleAuthenticate(
      validRequest(auth.systemId, { correlationId: "my-corr-id" }),
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
    const systemId = crypto.randomUUID() as SystemId;
    mockGetDb.mockRejectedValueOnce(new Error("DB connection failed"));
    manager.reserveUnauthSlot();
    const state = manager.register("conn-1", mockWs() as never, Date.now());

    const result = await handleAuthenticate(validRequest(systemId), state, manager, log);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTH_FAILED");
      expect(result.error.message).toBe("Authentication service unavailable");
    }
  });

  it("returns AUTH_FAILED when validateSession throws", async () => {
    const systemId = crypto.randomUUID() as SystemId;
    mockValidateSession.mockRejectedValueOnce(new Error("session service down"));
    manager.reserveUnauthSlot();
    const state = manager.register("conn-1", mockWs() as never, Date.now());

    const result = await handleAuthenticate(validRequest(systemId), state, manager, log);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTH_FAILED");
      expect(result.error.message).toBe("Authentication service unavailable");
    }
  });
});
