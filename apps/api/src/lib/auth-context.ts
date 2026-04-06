import type { AppLogger } from "./logger.js";
import type {
  AccountId,
  AccountType,
  ApiKeyId,
  ApiKeyScope,
  SessionId,
  SystemId,
} from "@pluralscape/types";

/** Fields shared by all authentication methods. */
interface BaseAuthContext {
  readonly accountId: AccountId;
  /** Null for viewer accounts that are not associated with a system. */
  readonly systemId: SystemId | null;
  readonly accountType: AccountType;
  /** Non-archived system IDs owned by this account, populated at auth time. */
  readonly ownedSystemIds: ReadonlySet<SystemId>;
  /** When true, IP address and user-agent are persisted in audit log entries (ADR 028). */
  readonly auditLogIpTracking: boolean;
}

/** Auth context for session-based authentication. */
export interface SessionAuthContext extends BaseAuthContext {
  readonly authMethod: "session";
  readonly sessionId: SessionId;
}

/** Auth context for API key authentication. */
export interface ApiKeyAuthContext extends BaseAuthContext {
  readonly authMethod: "apiKey";
  readonly keyId: ApiKeyId;
  readonly apiKeyScopes: readonly ApiKeyScope[];
}

/** Authenticated request context attached to Hono context by auth middleware. */
export type AuthContext = SessionAuthContext | ApiKeyAuthContext;

/**
 * Narrow to session auth, throwing if authenticated via API key.
 * Use at callsites that require a real session (logout, revocation, device transfer, biometric).
 */
export function requireSession(auth: AuthContext): SessionAuthContext {
  if (auth.authMethod !== "session") {
    throw new Error("This operation requires session authentication");
  }
  return auth;
}

/**
 * Extract session ID if authenticated via session, null otherwise.
 * Use for optional audit tracking where API key auth is acceptable.
 */
export function getSessionIdOrNull(auth: AuthContext): SessionId | null {
  return auth.authMethod === "session" ? auth.sessionId : null;
}

/** Hono environment type augmentation for authenticated routes. */
export interface AuthEnv {
  Variables: {
    requestId: string;
    log: AppLogger;
    auth: AuthContext;
  };
}
