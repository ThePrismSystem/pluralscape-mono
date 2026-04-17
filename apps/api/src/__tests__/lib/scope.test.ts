import { brandId } from "@pluralscape/types";
import { describe, expect, it } from "vitest";

import { hasScope } from "../../lib/scope.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, ApiKeyId, ApiKeyScope, RequiredScope, SystemId } from "@pluralscape/types";

const SYS = brandId<SystemId>("sys_a1b2c3d4-e5f6-7890-abcd-ef1234567890");

function apiKeyAuth(scopes: readonly ApiKeyScope[]): AuthContext {
  return {
    authMethod: "apiKey",
    accountId: brandId<AccountId>("acct_a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
    systemId: SYS,
    accountType: "system",
    ownedSystemIds: new Set([SYS]),
    auditLogIpTracking: false,
    keyId: brandId<ApiKeyId>("apk_a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
    apiKeyScopes: scopes,
  };
}

describe("hasScope", () => {
  it("returns false for write:audit-log (audit-log is read-only)", () => {
    const auth = apiKeyAuth(["write-all"]);
    expect(hasScope(auth, "write:audit-log" as RequiredScope)).toBe(false);
  });

  it("returns true for read:audit-log with read-all scope", () => {
    const auth = apiKeyAuth(["read-all"]);
    expect(hasScope(auth, "read:audit-log" as RequiredScope)).toBe(true);
  });

  it("returns true for read:audit-log with delete-all scope", () => {
    const auth = apiKeyAuth(["delete-all"]);
    expect(hasScope(auth, "read:audit-log" as RequiredScope)).toBe(true);
  });

  it("returns true for read:audit-log with specific scope", () => {
    const auth = apiKeyAuth(["read:audit-log" as ApiKeyScope]);
    expect(hasScope(auth, "read:audit-log" as RequiredScope)).toBe(true);
  });
});
