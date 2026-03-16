import { accounts, sessions, systems } from "@pluralscape/db/pg";
import { SESSION_TIMEOUTS, now } from "@pluralscape/types";
import { eq } from "drizzle-orm";

import type { AuthContext } from "./auth-context.js";
import type { SessionRow } from "@pluralscape/db/pg";
import type { AccountId, SessionId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Result type for session validation. */
export type ValidateSessionResult =
  | { ok: true; auth: AuthContext; session: SessionRow }
  | { ok: false; error: "UNAUTHENTICATED" | "SESSION_EXPIRED" };

/**
 * Validate a session token and return the auth context.
 *
 * Per design decision D2, the token IS the session ID directly.
 * Checks: exists, not revoked, not expired (absolute TTL), not idle-timed-out.
 */
export async function validateSession(
  db: PostgresJsDatabase,
  token: string,
): Promise<ValidateSessionResult> {
  // Look up session by ID (token is the session ID)
  const [session] = await db.select().from(sessions).where(eq(sessions.id, token)).limit(1);

  if (!session) {
    return { ok: false, error: "UNAUTHENTICATED" };
  }

  if (session.revoked) {
    return { ok: false, error: "UNAUTHENTICATED" };
  }

  const currentTime = now();

  // Check absolute expiry
  if (session.expiresAt !== null && currentTime > session.expiresAt) {
    return { ok: false, error: "SESSION_EXPIRED" };
  }

  // Check idle timeout
  if (session.lastActive !== null) {
    const idleTimeout = getIdleTimeout(session);
    if (idleTimeout !== null && currentTime - session.lastActive > idleTimeout) {
      return { ok: false, error: "SESSION_EXPIRED" };
    }
  }

  // Look up account type from accounts table
  const [account] = await db
    .select({ accountType: accounts.accountType })
    .from(accounts)
    .where(eq(accounts.id, session.accountId))
    .limit(1);

  if (!account) {
    return { ok: false, error: "UNAUTHENTICATED" };
  }

  // Look up system ID if system account
  let systemId: string | null = null;
  if (account.accountType === "system") {
    const [system] = await db
      .select({ id: systems.id })
      .from(systems)
      .where(eq(systems.accountId, session.accountId))
      .limit(1);
    systemId = system?.id ?? null;
  }

  return {
    ok: true,
    auth: {
      accountId: session.accountId as AccountId,
      systemId: systemId as SystemId | null,
      sessionId: session.id as SessionId,
      accountType: account.accountType,
    },
    session,
  };
}

/**
 * Determine idle timeout for a session based on its absolute TTL.
 * Maps absolute TTL to the corresponding idle timeout.
 */
function getIdleTimeout(session: SessionRow): number | null {
  if (session.expiresAt === null) return null;

  const absoluteTtl = session.expiresAt - session.createdAt;

  // Match against known timeout configurations
  if (absoluteTtl >= SESSION_TIMEOUTS.mobile.absoluteTtlMs) {
    return SESSION_TIMEOUTS.mobile.idleTimeoutMs;
  }
  if (absoluteTtl >= SESSION_TIMEOUTS.web.absoluteTtlMs) {
    return SESSION_TIMEOUTS.web.idleTimeoutMs;
  }

  // Device transfer or unknown — no idle timeout
  return null;
}
