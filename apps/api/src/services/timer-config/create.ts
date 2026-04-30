import { timerConfigs } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, brandId, toUnixMillis } from "@pluralscape/types";

import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
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
import type { CreateTimerConfigBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function createTimerConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  body: z.infer<typeof CreateTimerConfigBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<TimerConfigResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);

  const timerId = brandId<TimerId>(createId(ID_PREFIXES.timer));
  const timestamp = now();
  const isEnabled = body.enabled ?? true;
  const intervalMinutes = body.intervalMinutes ?? null;

  const nextCheckInAt =
    isEnabled && intervalMinutes !== null
      ? toUnixMillis(
          computeNextCheckInAt(
            {
              intervalMinutes,
              wakingHoursOnly: body.wakingHoursOnly ?? null,
              wakingStart: body.wakingStart ?? null,
              wakingEnd: body.wakingEnd ?? null,
            },
            Date.now(),
          ),
        )
      : null;

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .insert(timerConfigs)
      .values({
        id: timerId,
        systemId,
        enabled: isEnabled,
        intervalMinutes,
        wakingHoursOnly: body.wakingHoursOnly ?? null,
        wakingStart: body.wakingStart ?? null,
        wakingEnd: body.wakingEnd ?? null,
        nextCheckInAt,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create timer config — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "timer-config.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Timer config created",
      systemId,
    });

    return toTimerConfigResult(row);
  });
}
