import { z } from "zod/v4";

import { brandedIdQueryParam } from "./branded-id.js";
import { booleanQueryParam } from "./query-params.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

// ── HH:MM time format ──────────────────────────────────────────

/** Matches "HH:MM" where HH is 00-23 and MM is 00-59. */
const HH_MM_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const hhmmString = z.string().regex(HH_MM_REGEX, "Must be HH:MM format (00:00-23:59)");

// ── Timer config schemas ────────────────────────────────────────

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
      return data.wakingStart < data.wakingEnd;
    }
    return true;
  }, "wakingStart must be before wakingEnd");

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
      return data.wakingStart < data.wakingEnd;
    }
    return true;
  }, "wakingStart must be before wakingEnd")
  .readonly();

export const TimerConfigQuerySchema = z.object({
  includeArchived: booleanQueryParam,
});

// ── Check-in record schemas ─────────────────────────────────────

export const CreateCheckInRecordBodySchema = z.object({
  timerConfigId: brandedIdQueryParam("tmr_"),
  scheduledAt: z.number().int().min(0),
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
