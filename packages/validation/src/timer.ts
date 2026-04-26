import { z } from "zod/v4";

import { brandedIdQueryParam } from "./branded-id.js";
import { booleanQueryParam } from "./query-params.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

// ── HH:MM time format ──────────────────────────────────────────

/** Matches "HH:MM" where HH is 00-23 and MM is 00-59. */
const HH_MM_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const hhmmString = z.string().regex(HH_MM_REGEX, "Must be HH:MM format (00:00-23:59)");

const MINUTES_PER_HOUR = 60;
const MAX_HOUR = 23;
const MAX_MINUTE = 59;

/**
 * Parse an "HH:MM" string into total minutes since midnight.
 * Returns null if the format is invalid or values are out of range.
 */
export function parseTimeToMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = parseInt(match[1] as string, 10);
  const minutes = parseInt(match[2] as string, 10);
  if (hours > MAX_HOUR || minutes > MAX_MINUTE) return null;
  return hours * MINUTES_PER_HOUR + minutes;
}

// ── Timer config schemas ────────────────────────────────────────

/**
 * Runtime validator for the pre-encryption TimerConfig input.
 * Mirrors `TimerConfigEncryptedInput = Pick<TimerConfig, "promptText">`.
 */
export const TimerConfigEncryptedInputSchema = z
  .object({
    promptText: z.string().min(1),
  })
  .readonly();

export const CreateTimerConfigBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    enabled: z.boolean().optional(),
    intervalMinutes: z.number().int().min(1).optional(),
    wakingHoursOnly: z.boolean().optional(),
    wakingStart: hhmmString.optional(),
    wakingEnd: hhmmString.optional(),
  })
  .refine((data) => {
    if (data.wakingHoursOnly === true) {
      return data.wakingStart !== undefined && data.wakingEnd !== undefined;
    }
    return true;
  }, "wakingStart and wakingEnd are required when wakingHoursOnly is true")
  .refine((data) => {
    if (
      data.wakingHoursOnly === true &&
      data.wakingStart !== undefined &&
      data.wakingEnd !== undefined
    ) {
      const start = parseTimeToMinutes(data.wakingStart);
      const end = parseTimeToMinutes(data.wakingEnd);
      return start !== null && end !== null && start !== end;
    }
    return true;
  }, "wakingStart and wakingEnd must not be equal");

export const UpdateTimerConfigBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    version: z.int().min(1),
    enabled: z.boolean().optional(),
    intervalMinutes: z.number().int().min(1).nullable().optional(),
    wakingHoursOnly: z.boolean().optional(),
    wakingStart: hhmmString.nullable().optional(),
    wakingEnd: hhmmString.nullable().optional(),
  })
  .refine((data) => {
    if (data.wakingHoursOnly === true) {
      return (
        data.wakingStart !== undefined &&
        data.wakingStart !== null &&
        data.wakingEnd !== undefined &&
        data.wakingEnd !== null
      );
    }
    return true;
  }, "wakingStart and wakingEnd are required when wakingHoursOnly is true")
  .refine((data) => {
    if (
      data.wakingHoursOnly === true &&
      typeof data.wakingStart === "string" &&
      typeof data.wakingEnd === "string"
    ) {
      const start = parseTimeToMinutes(data.wakingStart);
      const end = parseTimeToMinutes(data.wakingEnd);
      return start !== null && end !== null && start !== end;
    }
    return true;
  }, "wakingStart and wakingEnd must not be equal")
  .readonly();

export const TimerConfigQuerySchema = z.object({
  includeArchived: booleanQueryParam,
});

// ── Check-in record schemas ─────────────────────────────────────

export const CreateCheckInRecordBodySchema = z.object({
  timerConfigId: brandedIdQueryParam("tmr_"),
  scheduledAt: z.number().int().min(1),
  encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE).optional(),
});

export const RespondCheckInRecordBodySchema = z.object({
  respondedByMemberId: brandedIdQueryParam("mem_"),
});

export const CheckInRecordQuerySchema = z.object({
  timerConfigId: brandedIdQueryParam("tmr_").optional(),
  pending: booleanQueryParam,
  includeArchived: booleanQueryParam,
});
