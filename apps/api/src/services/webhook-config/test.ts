import { webhookConfigs } from "@pluralscape/db/pg";
import { MS_PER_SECOND, now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { buildIpPinnedFetchArgs, resolveAndValidateUrl } from "../../lib/ip-validation.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { sendSignedWebhookRequest } from "../../lib/webhook-fetch.js";
import { HTTP_SUCCESS_MAX, HTTP_SUCCESS_MIN } from "../../service.constants.js";
import { computeWebhookSignature } from "../webhook-delivery-worker.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { FetchFn } from "../../lib/webhook-fetch.js";
import type { SystemId, WebhookId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Result of a synthetic webhook test delivery. */
export interface WebhookTestResult {
  readonly success: boolean;
  readonly httpStatus: number | null;
  readonly error: string | null;
  readonly durationMs: number;
}

/**
 * Send a synthetic test/ping delivery to the webhook endpoint inline
 * (not queued). Returns the HTTP result so users can verify their endpoint.
 */
export async function testWebhookConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  webhookId: WebhookId,
  auth: AuthContext,
  fetchFn: FetchFn = fetch,
): Promise<WebhookTestResult> {
  assertSystemOwnership(systemId, auth);

  const config = await withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select({
        id: webhookConfigs.id,
        systemId: webhookConfigs.systemId,
        url: webhookConfigs.url,
        secret: webhookConfigs.secret,
        enabled: webhookConfigs.enabled,
        archived: webhookConfigs.archived,
      })
      .from(webhookConfigs)
      .where(
        and(
          eq(webhookConfigs.id, webhookId),
          eq(webhookConfigs.systemId, systemId),
          eq(webhookConfigs.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Webhook config not found");
    }

    return row;
  });

  const testPayload = {
    event: "webhook.test",
    timestamp: now(),
  };
  const payloadJson = JSON.stringify(testPayload);
  const deliveryTimestamp = Math.floor(Date.now() / MS_PER_SECOND);

  const startMs = Date.now();

  let pinnedUrl: string;
  let hostHeader: string;
  try {
    const resolvedIps = await resolveAndValidateUrl(config.url);
    const firstIp = resolvedIps[0];
    if (!firstIp) throw new Error("Webhook URL hostname resolved to no IPs");
    ({ pinnedUrl, hostHeader } = buildIpPinnedFetchArgs(config.url, firstIp));
  } catch (err: unknown) {
    return {
      success: false,
      httpStatus: null,
      error: `SSRF validation failed: ${err instanceof Error ? err.message : String(err)}`,
      durationMs: Date.now() - startMs,
    };
  }

  const secretBuffer = Buffer.from(config.secret);
  try {
    const signature = computeWebhookSignature(secretBuffer, deliveryTimestamp, payloadJson);

    const fetchResult = await sendSignedWebhookRequest({
      url: pinnedUrl,
      signature,
      timestamp: deliveryTimestamp,
      payloadJson,
      fetchFn,
      hostHeader: pinnedUrl !== config.url ? hostHeader : undefined,
    });
    const durationMs = Date.now() - startMs;

    if ("error" in fetchResult) {
      const errorMessage =
        fetchResult.error === "timeout"
          ? "Request timed out"
          : "Webhook endpoint request failed (network error)";
      return { success: false, httpStatus: null, error: errorMessage, durationMs };
    }

    const success =
      fetchResult.httpStatus >= HTTP_SUCCESS_MIN && fetchResult.httpStatus <= HTTP_SUCCESS_MAX;

    return { success, httpStatus: fetchResult.httpStatus, error: null, durationMs };
  } finally {
    secretBuffer.fill(0);
  }
}
