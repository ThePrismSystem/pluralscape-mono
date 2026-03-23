import { webhookDeliveries } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, inArray, lt } from "drizzle-orm";

import { WEBHOOK_DELIVERY_RETENTION_DAYS } from "../service.constants.js";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Milliseconds per day. */
const MS_PER_DAY = 86_400_000;

/**
 * Purge terminal (success/failed) webhook delivery records older than the
 * retention period. Designed to run as a scheduled job (e.g., daily at 3 AM).
 *
 * Returns the number of records deleted.
 */
export async function cleanupWebhookDeliveries(
  db: PostgresJsDatabase,
  retentionDays: number = WEBHOOK_DELIVERY_RETENTION_DAYS,
): Promise<number> {
  const cutoff = now() - retentionDays * MS_PER_DAY;

  const deleted = await db
    .delete(webhookDeliveries)
    .where(
      and(
        inArray(webhookDeliveries.status, ["success", "failed"]),
        lt(webhookDeliveries.createdAt, cutoff),
      ),
    )
    .returning({ id: webhookDeliveries.id });

  return deleted.length;
}
