import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";

// ── Import under test ────────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;

const AUTH: AuthContext = {
  accountId: "acct_test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set([SYSTEM_ID]),
};

// ── Tests ─────────────────────────────────────────────────────────────

describe("assertSystemOwnership", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves when system is in ownedSystemIds", async () => {
    const { db } = mockDb();
    await expect(assertSystemOwnership(db, SYSTEM_ID, AUTH)).resolves.toBeUndefined();
  });

  it("throws 404 when system is not in ownedSystemIds", async () => {
    const { db } = mockDb();
    await expect(
      assertSystemOwnership(db, "sys_not-owned" as SystemId, AUTH),
    ).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
      message: "System not found",
    });
  });

  it("throws 404 when ownedSystemIds is empty", async () => {
    const { db } = mockDb();
    const emptyAuth: AuthContext = {
      ...AUTH,
      ownedSystemIds: new Set(),
    };
    await expect(assertSystemOwnership(db, SYSTEM_ID, emptyAuth)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });
});
