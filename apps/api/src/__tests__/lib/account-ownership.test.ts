import { describe, expect, it } from "vitest";

import { ApiHttpError } from "../../lib/api-error.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { AccountId } from "@pluralscape/types";

// ── Import under test ────────────────────────────────────────────────

const { assertAccountOwnership } = await import("../../lib/account-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const ACCOUNT_ID = "acct_test-account" as AccountId;

const AUTH = makeTestAuth({
  accountId: ACCOUNT_ID as string,
  sessionId: "sess_test-session",
});

// ── Tests ─────────────────────────────────────────────────────────────

describe("assertAccountOwnership", () => {
  it("does not throw when accountId matches auth.accountId", () => {
    expect(() => {
      assertAccountOwnership(ACCOUNT_ID, AUTH);
    }).not.toThrow();
  });

  it("throws 404 when accountId does not match", () => {
    expect(() => {
      assertAccountOwnership("acct_other" as AccountId, AUTH);
    }).toThrow(
      expect.objectContaining({
        status: 404,
        code: "NOT_FOUND",
        message: "Account not found",
      }),
    );
  });

  it("throws ApiHttpError (not a generic Error)", () => {
    expect(() => {
      assertAccountOwnership("acct_other" as AccountId, AUTH);
    }).toThrow(ApiHttpError);
  });

  it("works for viewer accounts with no owned systems", () => {
    const viewerAuth = makeTestAuth({
      accountId: ACCOUNT_ID as string,
      systemId: undefined,
      sessionId: "sess_test-session",
      accountType: "viewer",
      ownedSystemIds: new Set(),
    });
    expect(() => {
      assertAccountOwnership(ACCOUNT_ID, viewerAuth);
    }).not.toThrow();
  });
});
