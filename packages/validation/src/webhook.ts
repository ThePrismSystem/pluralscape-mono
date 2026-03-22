import { z } from "zod/v4";

import { brandedIdQueryParam } from "./branded-id.js";
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
    cryptoKeyId: z.string().startsWith("ak_").optional(),
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

// ── List query params ───────────────────────────────────────────

export const WebhookConfigQuerySchema = z.object({
  includeArchived: booleanQueryParam,
});

// ── Delivery list query params ──────────────────────────────────

const webhookDeliveryStatusSchema = z.enum(["pending", "success", "failed"]);

export const WebhookDeliveryQuerySchema = z.object({
  webhookId: brandedIdQueryParam("wh_").optional(),
  status: webhookDeliveryStatusSchema.optional(),
  eventType: webhookEventTypeSchema.optional(),
});
