import type { AppLogger } from "./logger.js";
import type { AccountId, AccountType, SessionId, SystemId } from "@pluralscape/types";

/** Authenticated request context attached to Hono context by auth middleware. */
export interface AuthContext {
  readonly accountId: AccountId;
  /** Null for viewer accounts that are not associated with a system. */
  readonly systemId: SystemId | null;
  readonly sessionId: SessionId;
  readonly accountType: AccountType;
  /** Non-archived system IDs owned by this account, populated at auth time. */
  readonly ownedSystemIds: ReadonlySet<SystemId>;
  /** When true, IP address and user-agent are persisted in audit log entries (ADR 028). */
  readonly auditLogIpTracking: boolean;
}

/** Hono environment type augmentation for authenticated routes. */
export interface AuthEnv {
  Variables: {
    requestId: string;
    log: AppLogger;
    auth: AuthContext;
  };
}
