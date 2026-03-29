import { cleanupWebhookDeliveries } from "../services/webhook-delivery-cleanup.js";

import type { JobHandler } from "@pluralscape/queue";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Creates a job handler for the `webhook-delivery-cleanup` job type.
 *
 * Deletes terminal (success/failed) webhook delivery records older than
 * the configured retention period (30 days) to limit storage growth.
 */
export function createWebhookDeliveryCleanupHandler(
  db: PostgresJsDatabase,
): JobHandler<"webhook-delivery-cleanup"> {
  return async (_job, ctx) => {
    if (ctx.signal.aborted) return;
    await cleanupWebhookDeliveries(db);
  };
}
