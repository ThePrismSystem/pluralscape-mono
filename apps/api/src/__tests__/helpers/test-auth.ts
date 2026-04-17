/**
 * Shared AuthContext factory for unit tests.
 *
 * Centralizes default values so adding fields to AuthContext does not
 * require updating every test file individually.
 */
import { brandId } from "@pluralscape/types";

import type { SessionAuthContext } from "../../lib/auth-context.js";
import type { AccountId, SessionId, SystemId } from "@pluralscape/types";

/** Default system ID used across service unit tests. */
const DEFAULT_SYSTEM_ID = brandId<SystemId>("sys_test");

/**
 * Relaxed override type so callers can pass plain strings without branded casts.
 * The factory applies the casts internally.
 */
interface TestAuthOverrides {
  readonly accountId?: string;
  readonly systemId?: string;
  readonly sessionId?: string;
  readonly accountType?: SessionAuthContext["accountType"];
  readonly ownedSystemIds?: ReadonlySet<SystemId>;
  readonly auditLogIpTracking?: boolean;
}

/** Create a test SessionAuthContext with sensible defaults. Override any field via the options. */
export function makeTestAuth(overrides?: TestAuthOverrides): SessionAuthContext {
  const systemId = brandId<SystemId>(overrides?.systemId ?? DEFAULT_SYSTEM_ID);
  return {
    authMethod: "session" as const,
    accountId: brandId<AccountId>(overrides?.accountId ?? "acct_test"),
    systemId,
    sessionId: brandId<SessionId>(overrides?.sessionId ?? "sess_test"),
    accountType: overrides?.accountType ?? "system",
    ownedSystemIds: overrides?.ownedSystemIds ?? new Set([systemId]),
    auditLogIpTracking: overrides?.auditLogIpTracking ?? false,
  };
}
