import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../lib/api-error.js";
import { assertSystemOwnership } from "../../lib/assert-system-ownership.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SessionId, SystemId } from "@pluralscape/types";

function fakeAuth(systemId: SystemId | null): AuthContext {
  return {
    accountId: "acc_test-account" as AccountId,
    systemId,
    sessionId: "ses_test-session" as SessionId,
    accountType: "system",
  };
}

describe("assertSystemOwnership (in-memory)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not throw when auth.systemId matches requested systemId", () => {
    const systemId = "sys_matching-id" as SystemId;
    const auth = fakeAuth(systemId);

    expect(() => { assertSystemOwnership(auth, systemId); }).not.toThrow();
  });

  it("throws 403 FORBIDDEN when systemIds do not match", () => {
    const auth = fakeAuth("sys_owner-system" as SystemId);
    const requestedId = "sys_other-system" as SystemId;

    const err = (() => {
      try {
        assertSystemOwnership(auth, requestedId);
      } catch (e: unknown) {
        return e;
      }
      return null;
    })();

    expect(err).toBeInstanceOf(ApiHttpError);
    expect(err).toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("throws 403 FORBIDDEN when auth.systemId is null", () => {
    const auth = fakeAuth(null);
    const requestedId = "sys_any-system" as SystemId;

    expect(() => { assertSystemOwnership(auth, requestedId); }).toThrow(
      expect.objectContaining({ status: 403, code: "FORBIDDEN" }),
    );
  });
});
