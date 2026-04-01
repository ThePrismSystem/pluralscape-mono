import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SessionId, SystemId } from "@pluralscape/types";

vi.mock("../../lib/db.js", () => ({
  getDb: vi.fn().mockResolvedValue({ __mock: "db" }),
}));

vi.mock("../../lib/session-auth.js", () => ({
  validateSession: vi.fn(),
}));

const { mockLogError } = vi.hoisted(() => ({
  mockLogError: vi.fn(),
}));

vi.mock("../../lib/logger.js", () => ({
  logger: {
    error: mockLogError,
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock tRPC fetch adapter to isolate middleware from the full router
vi.mock("@trpc/server/adapters/fetch", () => ({
  fetchRequestHandler: vi.fn().mockResolvedValue(new Response("ok")),
}));

// Mock tRPC module to prevent loading the full router graph
vi.mock("../../trpc/index.js", () => ({
  appRouter: {},
  createTRPCContext: vi.fn().mockResolvedValue({}),
}));

const { getDb } = await import("../../lib/db.js");
const { validateSession } = await import("../../lib/session-auth.js");
const { trpcRoute } = await import("../../routes/trpc.js");

const MOCK_AUTH: AuthContext = {
  accountId: "acct_550e8400-e29b-41d4-a716-446655440000" as AccountId,
  systemId: "sys_550e8400-e29b-41d4-a716-446655440000" as SystemId,
  sessionId: "sess_550e8400-e29b-41d4-a716-446655440000" as SessionId,
  accountType: "system",
  ownedSystemIds: new Set(["sys_550e8400-e29b-41d4-a716-446655440000" as SystemId]),
  auditLogIpTracking: false,
};

describe("tRPC route handler", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue({ __mock: "db" } as never);
    app = new Hono();
    app.route("/v1/trpc", trpcRoute);
  });

  it("skips auth when no authorization header is present", async () => {
    const res = await app.request("/v1/trpc/test");
    expect(res.status).toBe(200);
    expect(vi.mocked(validateSession)).not.toHaveBeenCalled();
  });

  it("validates session when valid Bearer token is present", async () => {
    vi.mocked(validateSession).mockResolvedValue({
      ok: true,
      auth: MOCK_AUTH,
    } as never);
    const res = await app.request("/v1/trpc/test", {
      headers: { authorization: "Bearer tok_test123" },
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(validateSession)).toHaveBeenCalledOnce();
  });

  it("skips auth for non-Bearer authorization header", async () => {
    const res = await app.request("/v1/trpc/test", {
      headers: { authorization: "Basic dXNlcjpwYXNz" },
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(validateSession)).not.toHaveBeenCalled();
  });

  it("continues without auth when token is invalid", async () => {
    vi.mocked(validateSession).mockResolvedValue({
      ok: false,
      error: "UNAUTHENTICATED",
    });
    const res = await app.request("/v1/trpc/test", {
      headers: { authorization: "Bearer bad_token" },
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(validateSession)).toHaveBeenCalledOnce();
  });

  it("returns 500 and logs error when validateSession throws", async () => {
    vi.mocked(validateSession).mockRejectedValue(new Error("DB connection lost"));
    const res = await app.request("/v1/trpc/test", {
      headers: { authorization: "Bearer tok_test123" },
    });
    expect(res.status).toBe(500);
    expect(mockLogError).toHaveBeenCalledOnce();
  });
});
