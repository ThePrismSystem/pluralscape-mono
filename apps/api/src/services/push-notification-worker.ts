import { deviceTokens } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { logger } from "../lib/logger.js";

import type { DeviceTokenPlatform, DeviceTokenId, JobPayloadMap } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Push provider interface ──────────────────────────────────────────

/** Payload shape for push notification delivery — derived from the job payload type. */
export type PushPayload = JobPayloadMap["notification-send"]["payload"];

/**
 * Interface for platform-specific push providers.
 * M8 will implement real APNs/FCM providers with encrypted token delivery;
 * M6 uses the stub which only needs the device token ID.
 */
export interface PushProvider {
  send(
    deviceTokenId: DeviceTokenId,
    platform: DeviceTokenPlatform,
    payload: PushPayload,
  ): Promise<void>;
}

/** M6 stub provider — logs the notification without delivering. */
export class StubPushProvider implements PushProvider {
  send(
    deviceTokenId: DeviceTokenId,
    platform: DeviceTokenPlatform,
    payload: PushPayload,
  ): Promise<void> {
    logger.info("[push-worker] stub delivery", {
      platform,
      title: payload.title,
      deviceTokenId,
    });
    return Promise.resolve();
  }
}

// ── Job processor ────────────────────────────────────────────────────

/** Default provider used when none is injected. */
const defaultProvider = new StubPushProvider();

/**
 * Process a single `notification-send` job.
 *
 * 1. Verifies the device token exists and is not revoked
 * 2. If token is revoked or missing, logs a warning and returns (no retry)
 * 3. Calls the provider to deliver the push notification
 * 4. Updates lastActiveAt on success
 * 5. Provider errors propagate for the queue retry policy to handle
 *
 * Note: plaintext push tokens are no longer stored in the database (hashed
 * with BLAKE2b). M8 will add encrypted token delivery via the job payload
 * or a secure token vault. The stub provider only needs the device token ID.
 */
export async function processPushNotification(
  db: PostgresJsDatabase,
  jobPayload: JobPayloadMap["notification-send"],
  provider: PushProvider = defaultProvider,
): Promise<void> {
  const { accountId, deviceTokenId, platform, payload } = jobPayload;

  // N.B. Uses raw `db` without RLS — intentional for background worker context
  // where there is no tenant auth session. The worker processes cross-tenant
  // notification jobs and needs unrestricted read access to device tokens.
  // The accountId WHERE clause ensures a corrupted payload cannot read
  // arbitrary device tokens — the token must belong to the expected account.
  const [record] = await db
    .select({
      id: deviceTokens.id,
      revokedAt: deviceTokens.revokedAt,
    })
    .from(deviceTokens)
    .where(and(eq(deviceTokens.id, deviceTokenId), eq(deviceTokens.accountId, accountId)))
    .limit(1);

  if (!record) {
    logger.warn("[push-worker] device token not found, skipping", { deviceTokenId });
    return;
  }

  if (record.revokedAt !== null) {
    logger.warn("[push-worker] device token revoked, skipping", { deviceTokenId });
    return;
  }

  // Deliver via provider — errors propagate for queue retry
  await provider.send(deviceTokenId, platform, payload);

  // Update lastActiveAt on successful delivery
  await db
    .update(deviceTokens)
    .set({ lastActiveAt: now() })
    .where(eq(deviceTokens.id, deviceTokenId));
}
