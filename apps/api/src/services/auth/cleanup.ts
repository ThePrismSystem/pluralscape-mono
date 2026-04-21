import { AUTH_KEY_HASH_BYTES } from "@pluralscape/crypto";
import { accounts } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq, lt } from "drizzle-orm";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Cleanup ──────────────────────────────────────────────────────

/**
 * Delete abandoned registration placeholders.
 *
 * An abandoned placeholder has an all-zero authKeyHash (never committed)
 * and an expired challenge nonce. Safe to call on a schedule.
 */
export async function cleanupExpiredRegistrations(db: PostgresJsDatabase): Promise<number> {
  const threshold = now();
  const zeroes = new Uint8Array(AUTH_KEY_HASH_BYTES);

  const deleted = await db
    .delete(accounts)
    .where(and(eq(accounts.authKeyHash, zeroes), lt(accounts.challengeExpiresAt, threshold)))
    .returning({ id: accounts.id });

  return deleted.length;
}
