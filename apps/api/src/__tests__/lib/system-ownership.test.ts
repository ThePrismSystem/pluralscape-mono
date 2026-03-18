import { describe, expect, it } from "vitest";

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
  it("does not throw when system is in ownedSystemIds", () => {
    expect(() => {
      assertSystemOwnership(SYSTEM_ID, AUTH);
    }).not.toThrow();
  });

  it("throws 404 when system is not in ownedSystemIds", () => {
    expect(() => {
      assertSystemOwnership("sys_not-owned" as SystemId, AUTH);
    }).toThrow(
      expect.objectContaining({
        status: 404,
        code: "NOT_FOUND",
        message: "System not found",
      }),
    );
  });

  it("throws 404 when ownedSystemIds is empty", () => {
    const emptyAuth: AuthContext = {
      ...AUTH,
      ownedSystemIds: new Set(),
    };
    expect(() => {
      assertSystemOwnership(SYSTEM_ID, emptyAuth);
    }).toThrow(
      expect.objectContaining({
        status: 404,
        code: "NOT_FOUND",
      }),
    );
  });
});
