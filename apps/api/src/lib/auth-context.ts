import type { AccountId, AccountType, SessionId, SystemId } from "@pluralscape/types";

/** Authenticated request context attached to Hono context by auth middleware. */
export interface AuthContext {
  readonly accountId: AccountId;
  /** Null for viewer accounts that are not associated with a system. */
  readonly systemId: SystemId | null;
  readonly sessionId: SessionId;
  readonly accountType: AccountType;
}

/** Hono environment type augmentation for authenticated routes. */
export interface AuthEnv {
  Variables: {
    requestId: string;
    auth: AuthContext;
  };
}
