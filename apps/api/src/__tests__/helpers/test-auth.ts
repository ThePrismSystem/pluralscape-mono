/**
 * Shared AuthContext factory for unit tests.
 *
 * Centralizes default values so adding fields to AuthContext does not
 * require updating every test file individually.
 */
import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SessionId, SystemId } from "@pluralscape/types";

/** Default system ID used across service unit tests. */
const DEFAULT_SYSTEM_ID = "sys_test" as SystemId;

/**
 * Relaxed override type so callers can pass plain strings without branded casts.
 * The factory applies the casts internally.
 */
interface TestAuthOverrides {
  readonly accountId?: string;
  readonly systemId?: string;
  readonly sessionId?: string;
  readonly accountType?: AuthContext["accountType"];
  readonly ownedSystemIds?: ReadonlySet<SystemId>;
  readonly auditLogIpTracking?: boolean;
}

/** Create a test AuthContext with sensible defaults. Override any field via the options. */
export function makeTestAuth(overrides?: TestAuthOverrides): AuthContext {
  const systemId = (overrides?.systemId ?? DEFAULT_SYSTEM_ID) as SystemId;
  return {
    accountId: (overrides?.accountId ?? "acct_test") as AccountId,
    systemId,
    sessionId: (overrides?.sessionId ?? "sess_test") as SessionId,
    accountType: overrides?.accountType ?? "system",
    ownedSystemIds: overrides?.ownedSystemIds ?? new Set([systemId]),
    auditLogIpTracking: overrides?.auditLogIpTracking ?? false,
  };
}
