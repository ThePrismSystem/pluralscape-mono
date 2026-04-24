import { webhookDeliveries } from "@pluralscape/db/pg";
import { now, toUnixMillis } from "@pluralscape/types";
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";

import {
  WEBHOOK_DELIVERY_CLEANUP_BATCH_SIZE,
  WEBHOOK_DELIVERY_RETENTION_DAYS,
} from "../service.constants.js";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Milliseconds per day. */
const MS_PER_DAY = 86_400_000;

/**
 * Purge terminal (success/failed) webhook delivery records older than the
 * retention period in batches. Designed to run as a scheduled job.
 *
 * Returns the total number of records deleted across all batches.
 */
export async function cleanupWebhookDeliveries(
  db: PostgresJsDatabase,
  retentionDays: number = WEBHOOK_DELIVERY_RETENTION_DAYS,
  batchSize: number = WEBHOOK_DELIVERY_CLEANUP_BATCH_SIZE,
): Promise<number> {
  const cutoff = toUnixMillis(now() - retentionDays * MS_PER_DAY);
  let totalDeleted = 0;
  let deletedCount = 0;

  do {
    const batch = await db
      .select({ id: webhookDeliveries.id })
      .from(webhookDeliveries)
      .where(
        and(
          or(eq(webhookDeliveries.status, "success"), eq(webhookDeliveries.status, "failed")),
          lt(webhookDeliveries.createdAt, cutoff),
        ),
      )
      .limit(batchSize);

    if (batch.length === 0) {
      break;
    }

    const ids = batch.map((r) => r.id);
    const deleted = await db
      .delete(webhookDeliveries)
      .where(inArray(webhookDeliveries.id, ids))
      .returning({ _: sql<number>`1` });

    deletedCount = deleted.length;
    totalDeleted += deletedCount;
  } while (deletedCount >= batchSize);

  return totalDeleted;
}
