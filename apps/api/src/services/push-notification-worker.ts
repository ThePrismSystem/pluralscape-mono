import { deviceTokens } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { logger } from "../lib/logger.js";

import type { DeviceTokenPlatform, JobPayloadMap } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Number of trailing characters to show in masked token log output. */
const TOKEN_LOG_VISIBLE_CHARS = 8;

// ── Push provider interface ──────────────────────────────────────────

/** Payload shape for push notification delivery — derived from the job payload type. */
export type PushPayload = JobPayloadMap["notification-send"]["payload"];

/**
 * Interface for platform-specific push providers.
 * M8 will implement real APNs/FCM providers; M6 uses the stub.
 */
export interface PushProvider {
  send(token: string, platform: DeviceTokenPlatform, payload: PushPayload): Promise<void>;
}

/** M6 stub provider — logs the notification without delivering. */
export class StubPushProvider implements PushProvider {
  send(token: string, platform: DeviceTokenPlatform, payload: PushPayload): Promise<void> {
    logger.info("[push-worker] stub delivery", {
      platform,
      title: payload.title,
      token:
        token.length > TOKEN_LOG_VISIBLE_CHARS
          ? `***${token.slice(-TOKEN_LOG_VISIBLE_CHARS)}`
          : token,
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
 * 1. Loads the device token by ID
 * 2. If token is revoked or missing, logs a warning and returns (no retry)
 * 3. Calls the provider to deliver the push notification
 * 4. Updates lastActiveAt on success
 * 5. Provider errors propagate for the queue retry policy to handle
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
  const [token] = await db
    .select({
      token: deviceTokens.token,
      revokedAt: deviceTokens.revokedAt,
    })
    .from(deviceTokens)
    .where(and(eq(deviceTokens.id, deviceTokenId), eq(deviceTokens.accountId, accountId)))
    .limit(1);

  if (!token) {
    logger.warn("[push-worker] device token not found, skipping", { deviceTokenId });
    return;
  }

  if (token.revokedAt !== null) {
    logger.warn("[push-worker] device token revoked, skipping", { deviceTokenId });
    return;
  }

  // Deliver via provider — errors propagate for queue retry
  await provider.send(token.token, platform, payload);

  // Update lastActiveAt on successful delivery
  await db
    .update(deviceTokens)
    .set({ lastActiveAt: now() })
    .where(eq(deviceTokens.id, deviceTokenId));
}
