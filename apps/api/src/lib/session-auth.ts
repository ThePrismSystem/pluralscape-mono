import { accounts, sessions, systems } from "@pluralscape/db/pg";
import { SESSION_TIMEOUTS, now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { hashSessionToken } from "./session-token.js";

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
 * Hashes the incoming Bearer token and looks up by tokenHash.
 * Checks: exists, not revoked, not expired (absolute TTL), not idle-timed-out.
 */
export async function validateSession(
  db: PostgresJsDatabase,
  token: string,
): Promise<ValidateSessionResult> {
  const tokenHash = hashSessionToken(token);

  // Session + account lookup (no system JOIN — systems fetched separately below)
  const [row] = await db
    .select({
      session: sessions,
      accountType: accounts.accountType,
      auditLogIpTracking: accounts.auditLogIpTracking,
    })
    .from(sessions)
    .innerJoin(accounts, eq(accounts.id, sessions.accountId))
    .where(eq(sessions.tokenHash, tokenHash))
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

  // Fetch all non-archived system IDs for system accounts (viewers never own systems)
  const accountId = row.session.accountId as AccountId;
  const systemRows =
    row.accountType === "system"
      ? await db
          .select({ id: systems.id })
          .from(systems)
          .where(and(eq(systems.accountId, accountId), eq(systems.archived, false)))
          .orderBy(systems.createdAt)
      : [];

  const ownedSystemIds = new Set(systemRows.map((r) => r.id as SystemId));
  const firstSystemId = systemRows[0]?.id as SystemId | undefined;

  return {
    ok: true,
    auth: {
      accountId,
      systemId: firstSystemId ?? null,
      sessionId: row.session.id as SessionId,
      accountType: row.accountType,
      ownedSystemIds,
      auditLogIpTracking: row.auditLogIpTracking,
    },
    session: row.session,
  };
}

/**
 * Determine idle timeout for a session based on its absolute TTL.
 * Uses exact match against known timeout configurations.
 */
export function getIdleTimeout(session: {
  expiresAt: number | null;
  createdAt: number;
}): number | null {
  if (session.expiresAt === null) return null;

  const absoluteTtl = session.expiresAt - session.createdAt;

  for (const config of Object.values(SESSION_TIMEOUTS)) {
    if (absoluteTtl === config.absoluteTtlMs) {
      return config.idleTimeoutMs;
    }
  }

  // Unknown session type — fail closed with shortest non-null idle timeout
  const allTimeouts = Object.values(SESSION_TIMEOUTS)
    .map((c) => c.idleTimeoutMs)
    .filter((ms) => ms !== null);
  return allTimeouts.length > 0 ? Math.min(...allTimeouts) : 0;
}
