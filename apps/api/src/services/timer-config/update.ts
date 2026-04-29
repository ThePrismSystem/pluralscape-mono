import { timerConfigs } from "@pluralscape/db/pg";
import { now, toUnixMillis } from "@pluralscape/types";
import { and, eq, sql } from "drizzle-orm";

import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
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
import type { UpdateTimerConfigBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function updateTimerConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  timerId: TimerId,
  body: z.infer<typeof UpdateTimerConfigBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<TimerConfigResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);
  const version = body.version;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const setClause: Partial<typeof timerConfigs.$inferInsert> = {
      encryptedData: blob,
      updatedAt: timestamp,
    };

    if (body.enabled !== undefined) {
      setClause.enabled = body.enabled;
    }
    if (body.intervalMinutes !== undefined) {
      setClause.intervalMinutes = body.intervalMinutes;
    }
    if (body.wakingHoursOnly !== undefined) {
      setClause.wakingHoursOnly = body.wakingHoursOnly;
    }
    if (body.wakingStart !== undefined) {
      setClause.wakingStart = body.wakingStart;
    }
    if (body.wakingEnd !== undefined) {
      setClause.wakingEnd = body.wakingEnd;
    }

    if (
      body.enabled !== undefined ||
      body.intervalMinutes !== undefined ||
      body.wakingHoursOnly !== undefined ||
      body.wakingStart !== undefined ||
      body.wakingEnd !== undefined
    ) {
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
        const effectiveEnabled = body.enabled ?? current.enabled;
        const effectiveInterval = body.intervalMinutes ?? current.intervalMinutes;

        if (effectiveEnabled && effectiveInterval !== null) {
          setClause.nextCheckInAt = toUnixMillis(
            computeNextCheckInAt(
              {
                intervalMinutes: effectiveInterval,
                wakingHoursOnly: body.wakingHoursOnly ?? current.wakingHoursOnly,
                wakingStart: body.wakingStart ?? current.wakingStart,
                wakingEnd: body.wakingEnd ?? current.wakingEnd,
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
