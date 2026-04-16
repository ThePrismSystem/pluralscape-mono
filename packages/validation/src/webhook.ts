import { z } from "zod/v4";

import { brandedIdQueryParam, optionalBrandedId } from "./branded-id.js";
import { booleanQueryParam } from "./query-params.js";
import {
  MAX_WEBHOOK_EVENT_TYPES,
  MAX_WEBHOOK_URL_LENGTH,
  WEBHOOK_EVENT_TYPE_VALUES,
} from "./validation.constants.js";

// ── Shared ──────────────────────────────────────────────────────

const webhookEventTypeSchema = z.enum(WEBHOOK_EVENT_TYPE_VALUES);

const urlSchema = z.string().min(1).max(MAX_WEBHOOK_URL_LENGTH).check(z.url());

// ── Create ──────────────────────────────────────────────────────

export const CreateWebhookConfigBodySchema = z
  .object({
    url: urlSchema,
    eventTypes: z.array(webhookEventTypeSchema).min(1).max(MAX_WEBHOOK_EVENT_TYPES),
    enabled: z.boolean().optional().default(true),
    cryptoKeyId: optionalBrandedId("ak_"),
  })
  .readonly();

// ── Update ──────────────────────────────────────────────────────

export const UpdateWebhookConfigBodySchema = z
  .object({
    url: urlSchema.optional(),
    eventTypes: z.array(webhookEventTypeSchema).min(1).max(MAX_WEBHOOK_EVENT_TYPES).optional(),
    enabled: z.boolean().optional(),
    version: z.int().min(1),
  })
  .readonly();

// ── Rotate Secret ──────────────────────────────────────────────

export const RotateWebhookSecretBodySchema = z
  .object({
    version: z.int().min(1),
  })
  .readonly();

// ── List query params ───────────────────────────────────────────

export const WebhookConfigQuerySchema = z.object({
  includeArchived: booleanQueryParam,
});

// ── Delivery list query params ──────────────────────────────────

const webhookDeliveryStatusSchema = z.enum(["pending", "success", "failed"]);

/**
 * Coerces a string query param to a positive integer, returning undefined when omitted.
 * Used for Unix-millisecond timestamp filters.
 */
const unixTimestampQueryParam = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (v === undefined) return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Expected a positive Unix timestamp",
      });
      return undefined;
    }
    return n;
  });

export const WebhookDeliveryQuerySchema = z.object({
  webhookId: brandedIdQueryParam("wh_").optional(),
  status: webhookDeliveryStatusSchema.optional(),
  eventType: webhookEventTypeSchema.optional(),
  fromDate: unixTimestampQueryParam,
  toDate: unixTimestampQueryParam,
});
