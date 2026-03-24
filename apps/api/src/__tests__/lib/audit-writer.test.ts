import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Context } from "hono";

const mockEnv = vi.hoisted(() => ({
  TRUST_PROXY: false,
}));

vi.mock("../../env.js", () => ({ env: mockEnv }));

// Mock writeAuditLog before importing the module under test
const writeAuditLogSpy = vi.fn().mockResolvedValue(undefined);
vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: writeAuditLogSpy,
}));

const { createAuditWriter } = await import("../../lib/audit-writer.js");

/** Build a minimal mock Hono context with the given headers. */
function createMockContext(headers: Record<string, string> = {}): Context {
  const headerMap = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    req: {
      header(name: string) {
        return headerMap.get(name.toLowerCase());
      },
    },
  } as Context;
}

/** Cast a test mock to PostgresJsDatabase. */
function asDb(mock: unknown): PostgresJsDatabase {
  return mock as PostgresJsDatabase;
}

function createMockDb(): PostgresJsDatabase {
  return asDb({ insert: vi.fn() });
}

/** Extract the WriteAuditLogParams from a mock call. */
function mockParams(callIndex: number): Record<string, unknown> {
  return writeAuditLogSpy.mock.calls[callIndex]?.[1] as Record<string, unknown>;
}

function createAuth(overrides?: Partial<AuthContext>): AuthContext {
  return {
    accountId: "acc_test-account" as AuthContext["accountId"],
    systemId: "sys_test-system" as AuthContext["systemId"],
    sessionId: "ses_test-session" as AuthContext["sessionId"],
    accountType: "system" as AuthContext["accountType"],
    ownedSystemIds: new Set(["sys_test-system" as AuthContext["systemId"] & string]),
    auditLogIpTracking: false,
    ...overrides,
  };
}

describe("createAuditWriter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    writeAuditLogSpy.mockReset().mockResolvedValue(undefined);
  });

  it("passes auth context accountId and systemId to writeAuditLog", async () => {
    const c = createMockContext({ "user-agent": "TestBrowser/1.0" });
    const auth = createAuth();
    const audit = createAuditWriter(c, auth);
    const db = createMockDb();

    await audit(db, {
      eventType: "auth.login",
      actor: { kind: "account", id: "acc_test-account" },
      detail: "Login successful",
    });

    expect(writeAuditLogSpy).toHaveBeenCalledOnce();
    const params = mockParams(0);
    expect(params).toMatchObject({
      accountId: "acc_test-account",
      systemId: "sys_test-system",
      eventType: "auth.login",
      actor: { kind: "account", id: "acc_test-account" },
      detail: "Login successful",
    });
  });

  it("sets accountId and systemId to null when no auth provided", async () => {
    const c = createMockContext();
    const audit = createAuditWriter(c);
    const db = createMockDb();

    await audit(db, {
      eventType: "auth.register",
      actor: { kind: "account", id: "acc_new" },
    });

    expect(writeAuditLogSpy).toHaveBeenCalledOnce();
    const params = mockParams(0);
    expect(params).toMatchObject({
      accountId: null,
      systemId: null,
    });
  });

  it("allows explicit accountId/systemId to override auth context", async () => {
    const c = createMockContext();
    const auth = createAuth();
    const audit = createAuditWriter(c, auth);
    const db = createMockDb();

    await audit(db, {
      eventType: "auth.login",
      actor: { kind: "account", id: "acc_override" },
      accountId: "acc_explicit" as AccountId,
      systemId: "sys_explicit" as SystemId,
    });

    expect(mockParams(0).accountId).toBe("acc_explicit");
    expect(mockParams(0).systemId).toBe("sys_explicit");
  });

  it("captures user-agent when auth.auditLogIpTracking is true", async () => {
    const c = createMockContext({ "user-agent": "PluralscapeApp/2.0" });
    const auth = createAuth({ auditLogIpTracking: true });
    const audit = createAuditWriter(c, auth);
    const db = createMockDb();

    await audit(db, {
      eventType: "auth.login",
      actor: { kind: "account", id: "acc_test" },
    });

    expect(mockParams(0).userAgent).toBe("PluralscapeApp/2.0");
  });

  it("excludes user-agent when auth.auditLogIpTracking is false", async () => {
    const c = createMockContext({ "user-agent": "PluralscapeApp/2.0" });
    const auth = createAuth({ auditLogIpTracking: false });
    const audit = createAuditWriter(c, auth);
    const db = createMockDb();

    await audit(db, {
      eventType: "auth.login",
      actor: { kind: "account", id: "acc_test" },
    });

    expect(mockParams(0).userAgent).toBeNull();
  });

  it("excludes IP/UA when no auth provided (unauthenticated)", async () => {
    mockEnv.TRUST_PROXY = true;

    const c = createMockContext({
      "x-forwarded-for": "203.0.113.50",
      "user-agent": "TestAgent",
    });
    const audit = createAuditWriter(c);
    const db = createMockDb();

    await audit(db, {
      eventType: "auth.register",
      actor: { kind: "account", id: "acc_test" },
    });

    expect(mockParams(0).ipAddress).toBeNull();
    expect(mockParams(0).userAgent).toBeNull();

    mockEnv.TRUST_PROXY = false;
  });

  it("captures IP from x-forwarded-for when opted in and TRUST_PROXY=true", async () => {
    mockEnv.TRUST_PROXY = true;

    const c = createMockContext({ "x-forwarded-for": "203.0.113.50, 10.0.0.1" });
    const auth = createAuth({ auditLogIpTracking: true });
    const audit = createAuditWriter(c, auth);
    const db = createMockDb();

    await audit(db, {
      eventType: "auth.login",
      actor: { kind: "account", id: "acc_test" },
    });

    expect(mockParams(0).ipAddress).toBe("203.0.113.50");

    mockEnv.TRUST_PROXY = false;
  });

  it("sets ipAddress to null when TRUST_PROXY is not set", async () => {
    mockEnv.TRUST_PROXY = false;

    const c = createMockContext({ "x-forwarded-for": "203.0.113.50" });
    const audit = createAuditWriter(c);
    const db = createMockDb();

    await audit(db, {
      eventType: "auth.login",
      actor: { kind: "account", id: "acc_test" },
    });

    expect(mockParams(0).ipAddress).toBeNull();
  });

  it("passes the db/tx instance through to writeAuditLog", async () => {
    const c = createMockContext();
    const audit = createAuditWriter(c);
    const db = createMockDb();

    await audit(db, {
      eventType: "auth.login",
      actor: { kind: "account", id: "acc_test" },
    });

    const firstCall = writeAuditLogSpy.mock.calls[0] as unknown[];
    expect(firstCall[0]).toBe(db);
  });

  it("defaults detail to undefined when not provided", async () => {
    const c = createMockContext();
    const audit = createAuditWriter(c);
    const db = createMockDb();

    await audit(db, {
      eventType: "auth.login",
      actor: { kind: "account", id: "acc_test" },
    });

    expect(mockParams(0).detail).toBeUndefined();
  });

  it("can be called multiple times with different params", async () => {
    const c = createMockContext({ "user-agent": "TestAgent" });
    const auth = createAuth({ auditLogIpTracking: true });
    const audit = createAuditWriter(c, auth);
    const db = createMockDb();

    await audit(db, {
      eventType: "auth.login",
      actor: { kind: "account", id: "acc_test-account" },
    });
    await audit(db, {
      eventType: "auth.logout",
      actor: { kind: "account", id: "acc_test-account" },
      detail: "User logged out",
    });

    expect(writeAuditLogSpy).toHaveBeenCalledTimes(2);
    expect(mockParams(0).eventType).toBe("auth.login");
    expect(mockParams(1).eventType).toBe("auth.logout");
    // Both calls share the same userAgent from context (opted in)
    expect(mockParams(0).userAgent).toBe("TestAgent");
    expect(mockParams(1).userAgent).toBe("TestAgent");
  });
});
