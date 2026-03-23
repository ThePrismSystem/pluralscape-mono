import { DATE_RANGE_PRESETS } from "@pluralscape/types";
import { z } from "zod/v4";

import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

// ── Analytics query params ─────────────────────────────────────

export const AnalyticsQuerySchema = z
  .object({
    preset: z.enum(DATE_RANGE_PRESETS).optional(),
    startDate: z
      .string()
      .transform((v) => Number(v))
      .pipe(z.number().int().min(0))
      .optional(),
    endDate: z
      .string()
      .transform((v) => Number(v))
      .pipe(z.number().int().min(0))
      .optional(),
  })
  .refine(
    (data) => {
      if (data.preset === "custom") {
        return data.startDate !== undefined && data.endDate !== undefined;
      }
      return true;
    },
    { message: "startDate and endDate are required when preset is 'custom'" },
  )
  .refine(
    (data) => {
      if (data.startDate !== undefined && data.endDate !== undefined) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    { message: "endDate must be >= startDate" },
  );

// ── Create fronting report ─────────────────────────────────────

export const CreateFrontingReportBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    format: z.enum(["html", "pdf"]),
    generatedAt: z.number().int().min(0),
  })
  .readonly();
