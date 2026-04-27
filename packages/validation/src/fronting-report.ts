import { z } from "zod/v4";

import { brandedNumber, brandedString } from "./branded.js";

import type { FrontingReportEncryptedInput } from "@pluralscape/types";

/** Minimum value for a percentage field (inclusive). */
const PERCENTAGE_MIN = 0;
/** Maximum value for a percentage field (inclusive). */
const PERCENTAGE_MAX = 100;

const DateRangeSchema = z
  .object({
    start: brandedNumber<"UnixMillis">(),
    end: brandedNumber<"UnixMillis">(),
  })
  .refine((d) => d.start <= d.end, {
    message: "DateRange.start must be <= DateRange.end",
    path: ["start"],
  })
  .readonly();

const MemberFrontingBreakdownSchema = z
  .object({
    memberId: brandedString<"MemberId">(),
    totalDuration: brandedNumber<"Duration">(),
    sessionCount: z.number().int().nonnegative(),
    averageSessionLength: brandedNumber<"Duration">(),
    percentageOfTotal: z.number().min(PERCENTAGE_MIN).max(PERCENTAGE_MAX),
  })
  .readonly();

const ChartDatasetSchema = z
  .object({
    label: z.string(),
    data: z.array(z.number()).readonly(),
    color: z.string(),
  })
  .readonly();

const ChartDataSchema = z
  .object({
    chartType: z.enum(["pie", "bar", "timeline"]),
    labels: z.array(z.string()).readonly(),
    datasets: z.array(ChartDatasetSchema).readonly(),
  })
  .readonly();

/**
 * Zod schema for `FrontingReportEncryptedInput` — the encrypted-input
 * projection of `FrontingReport` (Class A, subset of domain keys). Validates
 * the in-memory shape after decrypt; wired at the decrypt boundary in
 * `packages/data/src/transforms/fronting-report.ts:decryptFrontingReport`.
 */
export const FrontingReportEncryptedInputSchema: z.ZodType<FrontingReportEncryptedInput> = z
  .object({
    dateRange: DateRangeSchema,
    memberBreakdowns: z.array(MemberFrontingBreakdownSchema).readonly(),
    chartData: z.array(ChartDataSchema).readonly(),
  })
  .readonly();
