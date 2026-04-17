/**
 * Shared mock data used by both REST route tests and tRPC router tests.
 * Single source of truth for test auth contexts and IDs.
 */
import { brandId } from "@pluralscape/types";

import type { SessionAuthContext } from "../../lib/auth-context.js";
import type { AccountId, SessionId, SystemId } from "@pluralscape/types";

/** System ID used across all tests. */
export const MOCK_SYSTEM_ID = brandId<SystemId>("sys_550e8400-e29b-41d4-a716-446655440000");

/** Shared auth context for system-scoped tests. */
export const MOCK_AUTH: SessionAuthContext = {
  authMethod: "session" as const,
  accountId: brandId<AccountId>("acct_test001"),
  systemId: MOCK_SYSTEM_ID,
  sessionId: brandId<SessionId>("sess_test001"),
  accountType: "system",
  ownedSystemIds: new Set([MOCK_SYSTEM_ID]),
  auditLogIpTracking: false,
};

/** Auth context for account-level routes with no active system. */
export const MOCK_ACCOUNT_ONLY_AUTH: SessionAuthContext = {
  authMethod: "session" as const,
  accountId: brandId<AccountId>("acct_test001"),
  systemId: null,
  sessionId: brandId<SessionId>("sess_test001"),
  accountType: "system",
  ownedSystemIds: new Set<SystemId>(),
  auditLogIpTracking: false,
};
