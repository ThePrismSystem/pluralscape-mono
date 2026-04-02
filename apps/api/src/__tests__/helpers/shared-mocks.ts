/**
 * Shared mock data used by both REST route tests and tRPC router tests.
 * Single source of truth for test auth contexts and IDs.
 */
import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";

/** System ID used across all tests. */
export const MOCK_SYSTEM_ID = "sys_550e8400-e29b-41d4-a716-446655440000" as SystemId;

/** Shared auth context for system-scoped tests. */
export const MOCK_AUTH: AuthContext = {
  accountId: "acct_test001" as AuthContext["accountId"],
  systemId: MOCK_SYSTEM_ID,
  sessionId: "sess_test001" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set([MOCK_SYSTEM_ID]),
  auditLogIpTracking: false,
};

/** Auth context for account-level routes with no active system. */
export const MOCK_ACCOUNT_ONLY_AUTH: AuthContext = {
  accountId: "acct_test001" as AuthContext["accountId"],
  systemId: null,
  sessionId: "sess_test001" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set<SystemId>(),
  auditLogIpTracking: false,
};
