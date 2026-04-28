import { sessions } from "@pluralscape/db/pg";
import { brandId, now } from "@pluralscape/types";
import { and, eq, gt, isNull, ne, or } from "drizzle-orm";

import { encryptedBlobToBase64OrNull } from "../../lib/encrypted-blob.js";
import { toCursor } from "../../lib/pagination.js";
import { withAccountRead, withAccountTransaction } from "../../lib/rls-context.js";
import { buildIdleTimeoutFilter } from "../../lib/session-idle-filter.js";
import { DEFAULT_SESSION_LIMIT, MAX_SESSION_LIMIT } from "../../routes/auth/auth.constants.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AccountId, EncryptedBase64, PaginationCursor, SessionId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Session management ─────────────────────────────────────────────

export interface SessionInfo {
  readonly id: SessionId;
  readonly createdAt: number;
  readonly lastActive: number | null;
  readonly expiresAt: number | null;
  /**
   * Base64-encoded T1 ciphertext blob carrying the per-session DeviceInfo
   * payload (platform, appVersion, deviceName). Decrypted client-side via
   * `decryptDeviceInfo` from `@pluralscape/data`. Null on legacy rows that
   * pre-date device-info capture.
   */
  readonly encryptedData: EncryptedBase64 | null;
}

export async function listSessions(
  db: PostgresJsDatabase,
  accountId: AccountId,
  cursor?: string,
  limit = DEFAULT_SESSION_LIMIT,
): Promise<{ sessions: SessionInfo[]; nextCursor: PaginationCursor | null }> {
  const effectiveLimit = Math.min(limit, MAX_SESSION_LIMIT);

  return withAccountRead(db, accountId, async (tx) => {
    const currentTime = now();
    const notExpired = or(isNull(sessions.expiresAt), gt(sessions.expiresAt, currentTime));

    const conditions = [
      eq(sessions.accountId, accountId),
      eq(sessions.revoked, false),
      notExpired,
      buildIdleTimeoutFilter(currentTime),
    ];
    if (cursor) {
      conditions.push(gt(sessions.id, brandId<SessionId>(cursor)));
    }

    const rows = await tx
      .select({
        id: sessions.id,
        createdAt: sessions.createdAt,
        lastActive: sessions.lastActive,
        expiresAt: sessions.expiresAt,
        encryptedData: sessions.encryptedData,
      })
      .from(sessions)
      .where(and(...conditions))
      .orderBy(sessions.id)
      .limit(effectiveLimit + 1);

    const hasMore = rows.length > effectiveLimit;
    const sliced = hasMore ? rows.slice(0, effectiveLimit) : rows;
    const result: SessionInfo[] = sliced.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      lastActive: row.lastActive,
      expiresAt: row.expiresAt,
      encryptedData: encryptedBlobToBase64OrNull(row.encryptedData),
    }));
    const lastId = result[result.length - 1]?.id;
    const nextCursor = hasMore && lastId ? toCursor(lastId) : null;

    return { sessions: result, nextCursor };
  });
}

export async function revokeSession(
  db: PostgresJsDatabase,
  sessionId: SessionId,
  actorAccountId: AccountId,
  audit: AuditWriter,
): Promise<boolean> {
  return withAccountTransaction(db, actorAccountId, async (tx) => {
    const updated = await tx
      .update(sessions)
      .set({ revoked: true })
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.accountId, actorAccountId),
          eq(sessions.revoked, false),
        ),
      )
      .returning({ id: sessions.id });

    if (updated.length === 0) {
      return false;
    }

    await audit(tx, {
      eventType: "auth.logout",
      actor: { kind: "account", id: actorAccountId },
      detail: `Session ${sessionId} revoked`,
    });

    return true;
  });
}

export async function revokeAllSessions(
  db: PostgresJsDatabase,
  accountId: AccountId,
  exceptSessionId: SessionId,
  audit: AuditWriter,
): Promise<number> {
  return withAccountTransaction(db, accountId, async (tx) => {
    const result = await tx
      .update(sessions)
      .set({ revoked: true })
      .where(
        and(
          eq(sessions.accountId, accountId),
          ne(sessions.id, exceptSessionId),
          eq(sessions.revoked, false),
        ),
      )
      .returning({ id: sessions.id });

    await audit(tx, {
      eventType: "auth.logout",
      actor: { kind: "account", id: accountId },
      detail: `All sessions revoked except ${exceptSessionId} (${String(result.length)} sessions)`,
    });

    return result.length;
  });
}

export async function logoutCurrentSession(
  db: PostgresJsDatabase,
  sessionId: SessionId,
  accountId: AccountId,
  audit: AuditWriter,
): Promise<void> {
  await withAccountTransaction(db, accountId, async (tx) => {
    await tx
      .update(sessions)
      .set({ revoked: true })
      .where(and(eq(sessions.id, sessionId), eq(sessions.accountId, accountId)));

    await audit(tx, {
      eventType: "auth.logout",
      actor: { kind: "account", id: accountId },
      detail: "Logged out",
    });
  });
}
