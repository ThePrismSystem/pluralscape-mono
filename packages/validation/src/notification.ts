import { z } from "zod/v4";

import {
  DEVICE_TOKEN_PLATFORM_VALUES,
  FRIEND_NOTIFICATION_EVENT_TYPE_VALUES,
  MAX_DEVICE_TOKEN_LENGTH,
} from "./validation.constants.js";

// ── Device token schemas ─────────────────────────────────────────────

export const RegisterDeviceTokenBodySchema = z
  .object({
    platform: z.enum(DEVICE_TOKEN_PLATFORM_VALUES),
    token: z.string().min(1).max(MAX_DEVICE_TOKEN_LENGTH),
  })
  .readonly();

export const UpdateDeviceTokenBodySchema = z
  .object({
    platform: z.enum(DEVICE_TOKEN_PLATFORM_VALUES).optional(),
    token: z.string().min(1).max(MAX_DEVICE_TOKEN_LENGTH).optional(),
  })
  .refine((d) => d.platform !== undefined || d.token !== undefined, {
    message: "At least one of platform or token must be provided",
  });

// ── Notification config schemas ──────────────────────────────────────

export const UpdateNotificationConfigBodySchema = z
  .object({
    enabled: z.boolean().optional(),
    pushEnabled: z.boolean().optional(),
  })
  .refine((d) => d.enabled !== undefined || d.pushEnabled !== undefined, {
    message: "At least one of enabled or pushEnabled must be provided",
  });

// ── Friend notification preference schemas ───────────────────────────

export const UpdateFriendNotificationPreferenceBodySchema = z
  .object({
    enabledEventTypes: z.array(z.enum(FRIEND_NOTIFICATION_EVENT_TYPE_VALUES)),
  })
  .readonly();
