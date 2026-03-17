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
  // Single JOIN query: session + account + optional system
  const [row] = await db
    .select({
      session: sessions,
      accountType: accounts.accountType,
      systemId: systems.id,
    })
    .from(sessions)
    .innerJoin(accounts, eq(accounts.id, sessions.accountId))
    .leftJoin(systems, eq(systems.accountId, sessions.accountId))
    .where(eq(sessions.id, token))
    .limit(1);

  if (!row) {
    return { ok: false, error: "UNAUTHENTICATED" };
  }

  if (row.session.revoked) {
    return { ok: false, error: "UNAUTHENTICATED" };
  }

  const currentTime = now();

  // Check absolute expiry
  if (row.session.expiresAt !== null && currentTime > row.session.expiresAt) {
    return { ok: false, error: "SESSION_EXPIRED" };
  }

  // Check idle timeout
  if (row.session.lastActive !== null) {
    const idleTimeout = getIdleTimeout(row.session);
    if (idleTimeout !== null && currentTime - row.session.lastActive > idleTimeout) {
      return { ok: false, error: "SESSION_EXPIRED" };
    }
  }

  return {
    ok: true,
    auth: {
      accountId: row.session.accountId as AccountId,
      systemId: (row.systemId ?? null) as SystemId | null,
      sessionId: row.session.id as SessionId,
      accountType: row.accountType,
    },
    session: row.session,
  };
}

/**
 * Determine idle timeout for a session based on its absolute TTL.
 * Uses exact match against known timeout configurations.
 */
function getIdleTimeout(session: SessionRow): number | null {
  if (session.expiresAt === null) return null;

  const absoluteTtl = session.expiresAt - session.createdAt;

  for (const config of Object.values(SESSION_TIMEOUTS)) {
    if (absoluteTtl === config.absoluteTtlMs) {
      return config.idleTimeoutMs;
    }
  }

  // Device transfer or unknown — no idle timeout
  return null;
}
