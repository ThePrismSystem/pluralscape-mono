import { timerConfigs } from "@pluralscape/db/pg";
import { now, toUnixMillis } from "@pluralscape/types";
import { UpdateTimerConfigBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

// eslint-disable-next-line pluralscape/no-params-unknown
import { parseAndValidateBlob } from "../../lib/encrypted-blob.js";
import { assertOccUpdated } from "../../lib/occ-update.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { computeNextCheckInAt } from "../../lib/timer-scheduling.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";

import { toTimerConfigResult } from "./internal.js";

import type { TimerConfigResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId, TimerId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function updateTimerConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  timerId: TimerId,
  // eslint-disable-next-line pluralscape/no-params-unknown
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<TimerConfigResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateTimerConfigBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );
  const version = parsed.version;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const setClause: Partial<typeof timerConfigs.$inferInsert> = {
      encryptedData: blob,
      updatedAt: timestamp,
    };

    if (parsed.enabled !== undefined) {
      setClause.enabled = parsed.enabled;
    }
    if (parsed.intervalMinutes !== undefined) {
      setClause.intervalMinutes = parsed.intervalMinutes;
    }
    if (parsed.wakingHoursOnly !== undefined) {
      setClause.wakingHoursOnly = parsed.wakingHoursOnly;
    }
    if (parsed.wakingStart !== undefined) {
      setClause.wakingStart = parsed.wakingStart;
    }
    if (parsed.wakingEnd !== undefined) {
      setClause.wakingEnd = parsed.wakingEnd;
    }

    // Recompute nextCheckInAt when scheduling-related fields change
    if (
      parsed.enabled !== undefined ||
      parsed.intervalMinutes !== undefined ||
      parsed.wakingHoursOnly !== undefined ||
      parsed.wakingStart !== undefined ||
      parsed.wakingEnd !== undefined
    ) {
      // We need the current config to merge with updated fields
      const [current] = await tx
        .select()
        .from(timerConfigs)
        .where(
          and(
            eq(timerConfigs.id, timerId),
            eq(timerConfigs.systemId, systemId),
            eq(timerConfigs.archived, false),
          ),
        )
        .limit(1);

      if (current) {
        const effectiveEnabled = parsed.enabled ?? current.enabled;
        const effectiveInterval = parsed.intervalMinutes ?? current.intervalMinutes;

        if (effectiveEnabled && effectiveInterval !== null) {
          setClause.nextCheckInAt = toUnixMillis(
            computeNextCheckInAt(
              {
                intervalMinutes: effectiveInterval,
                wakingHoursOnly: parsed.wakingHoursOnly ?? current.wakingHoursOnly,
                wakingStart: parsed.wakingStart ?? current.wakingStart,
                wakingEnd: parsed.wakingEnd ?? current.wakingEnd,
              },
              Date.now(),
            ),
          );
        } else {
          setClause.nextCheckInAt = null;
        }
      }
    }

    const updated = await tx
      .update(timerConfigs)
      .set({
        ...setClause,
        version: sql<number>`${timerConfigs.version} + 1`,
      })
      .where(
        and(
          eq(timerConfigs.id, timerId),
          eq(timerConfigs.systemId, systemId),
          eq(timerConfigs.version, version),
          eq(timerConfigs.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: timerConfigs.id })
          .from(timerConfigs)
          .where(
            and(
              eq(timerConfigs.id, timerId),
              eq(timerConfigs.systemId, systemId),
              eq(timerConfigs.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Timer config",
    );

    await audit(tx, {
      eventType: "timer-config.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Timer config updated",
      systemId,
    });

    return toTimerConfigResult(row);
  });
}
