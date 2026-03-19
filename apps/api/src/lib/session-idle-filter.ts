import { sessions } from "@pluralscape/db/pg";
import { SESSION_TIMEOUTS } from "@pluralscape/types";
import { and, gte, isNull, not, or, sql } from "drizzle-orm";

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
 *
 * SQL correctness notes:
 * - pgTimestamp columns store timestamptz but map to/from UnixMillis in TypeScript.
 *   Drizzle's gte() applies the custom type's toDriver conversion (UnixMillis → ISO string),
 *   producing valid `timestamptz >= timestamptz` comparisons that can use indexes.
 * - TTL matching uses EXTRACT(EPOCH FROM interval) * 1000 to convert PG interval to ms
 *   before comparing to integer parameters.
 */
export function buildIdleTimeoutFilter(currentTimeMs: number): SQL {
  const conditions: SQL[] = [];

  // Sessions with null lastActive or null expiresAt — always included
  conditions.push(isNull(sessions.lastActive));
  conditions.push(isNull(sessions.expiresAt));

  for (const config of Object.values(SESSION_TIMEOUTS)) {
    const ttlMatchExpr = sql`EXTRACT(EPOCH FROM (${sessions.expiresAt} - ${sessions.createdAt})) * 1000 = ${config.absoluteTtlMs}`;

    if (config.idleTimeoutMs === null) {
      // No idle timeout for this session type — match by absoluteTtl
      conditions.push(ttlMatchExpr);
    } else {
      // Idle timeout applies: must match absoluteTtl AND be within idle window.
      // Use gte() with pre-computed threshold for index-friendly comparison.
      const thresholdMs = currentTimeMs - config.idleTimeoutMs;
      const condition = and(ttlMatchExpr, gte(sessions.lastActive, thresholdMs));
      if (!condition) throw new Error("Invariant: and() returned undefined with non-empty args");
      conditions.push(condition);
    }
  }

  // Sessions with unknown absoluteTtl (not matching any config) — pass through.
  // Build a NOT IN check for all known absoluteTtls.
  const knownTtls = Object.values(SESSION_TIMEOUTS).map((c) => c.absoluteTtlMs);
  const unknownTtlCondition = and(
    not(isNull(sessions.expiresAt)),
    sql`EXTRACT(EPOCH FROM (${sessions.expiresAt} - ${sessions.createdAt})) * 1000 NOT IN (${sql.join(
      knownTtls.map((t) => sql`${t}`),
      sql`, `,
    )})`,
  );
  if (!unknownTtlCondition)
    throw new Error("Invariant: and() returned undefined with non-empty args");
  conditions.push(unknownTtlCondition);

  const result = or(...conditions);
  if (!result) throw new Error("Invariant: or() returned undefined with non-empty args");
  return result;
}
