import { processWebhookDelivery } from "../services/webhook-delivery-worker.js";

import type { JobHandler } from "@pluralscape/queue";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Creates a job handler for the `webhook-deliver` job type.
 *
 * Delegates to `processWebhookDelivery()` which handles HTTP delivery,
 * HMAC signing, retry logic, and status updates for a single webhook
 * delivery record.
 */
export function createWebhookDeliverHandler(db: PostgresJsDatabase): JobHandler<"webhook-deliver"> {
  return async (job, ctx) => {
    if (ctx.signal.aborted) return;
    await processWebhookDelivery(db, job.payload.deliveryId, job.payload.payload);
  };
}
