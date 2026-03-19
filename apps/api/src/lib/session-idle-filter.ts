import { sessions } from "@pluralscape/db/pg";
import { SESSION_TIMEOUTS } from "@pluralscape/types";
import { and, isNull, not, or, sql } from "drizzle-orm";

import type { SQL } from "drizzle-orm";

/**
 * Builds a drizzle SQL condition that filters out idle-timed-out sessions.
 *
 * For each entry in SESSION_TIMEOUTS:
 * - If idleTimeoutMs is null: no idle check (session always passes)
 * - If idleTimeoutMs is set: lastActive must be within idleTimeoutMs of currentTimeMs
 *
 * Sessions with null lastActive or null expiresAt always pass (no idle check possible).
 * Sessions whose absoluteTtl doesn't match any known config pass by default.
 */
export function buildIdleTimeoutFilter(currentTimeMs: number): SQL {
  const conditions: SQL[] = [];

  // Sessions with null lastActive or null expiresAt — always included
  conditions.push(isNull(sessions.lastActive));
  conditions.push(isNull(sessions.expiresAt));

  for (const config of Object.values(SESSION_TIMEOUTS)) {
    if (config.idleTimeoutMs === null) {
      // No idle timeout for this session type — match by absoluteTtl
      conditions.push(
        sql`(${sessions.expiresAt} - ${sessions.createdAt} = ${config.absoluteTtlMs})`,
      );
    } else {
      // Idle timeout applies: must match absoluteTtl AND be within idle window
      conditions.push(
        and(
          sql`(${sessions.expiresAt} - ${sessions.createdAt} = ${config.absoluteTtlMs})`,
          sql`(${currentTimeMs} - ${sessions.lastActive} <= ${config.idleTimeoutMs})`,
        ) as SQL,
      );
    }
  }

  // Sessions with unknown absoluteTtl (not matching any config) — pass through.
  // Build a NOT IN check for all known absoluteTtls.
  const knownTtls = Object.values(SESSION_TIMEOUTS).map((c) => c.absoluteTtlMs);
  const unknownTtlCondition = and(
    not(isNull(sessions.expiresAt)),
    not(isNull(sessions.lastActive)),
    sql`(${sessions.expiresAt} - ${sessions.createdAt}) NOT IN (${sql.join(
      knownTtls.map((t) => sql`${t}`),
      sql`, `,
    )})`,
  );
  conditions.push(unknownTtlCondition as SQL);

  return or(...conditions) as SQL;
}
