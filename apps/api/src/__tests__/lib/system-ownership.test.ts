import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("@pluralscape/db/pg", () => ({
  systems: { id: "id", accountId: "accountId", archived: "archived" },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  eq: vi.fn((col: unknown, val: unknown) => ({ type: "eq", col, val })),
}));

// ── Import under test ────────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;

const AUTH: AuthContext = {
  accountId: "acct_test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session" as AuthContext["sessionId"],
  accountType: "system",
};

// ── Tests ─────────────────────────────────────────────────────────────

describe("assertSystemOwnership", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves when system is owned by the authenticated account", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);

    await expect(assertSystemOwnership(db, SYSTEM_ID, AUTH)).resolves.toBeUndefined();
  });

  it("throws 404 when system does not belong to this account", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await expect(assertSystemOwnership(db, SYSTEM_ID, AUTH)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
      message: "System not found",
    });
  });

  it("throws 404 for archived system (filtered by archived=false)", async () => {
    const { db, chain } = mockDb();
    // The query filters archived=false, so an archived system returns no rows
    chain.limit.mockResolvedValueOnce([]);

    const archivedAuth: AuthContext = {
      ...AUTH,
      systemId: "sys_archived" as SystemId,
    };

    await expect(
      assertSystemOwnership(db, "sys_archived" as SystemId, archivedAuth),
    ).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("throws 404 for nonexistent system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      assertSystemOwnership(db, "sys_does-not-exist" as SystemId, AUTH),
    ).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });
});
