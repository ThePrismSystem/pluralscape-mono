import { DATE_RANGE_PRESETS, MS_PER_DAY } from "@pluralscape/types";
import { MAX_ANALYTICS_CUSTOM_RANGE_MS } from "@pluralscape/validation";
import { z } from "zod/v4";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import {
  computeCoFrontingBreakdown,
  computeFrontingBreakdown,
} from "../../services/analytics.service.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

import type { DateRangeFilter, UnixMillis } from "@pluralscape/types";

/** tRPC-native analytics date range input — uses numbers, not query-param strings. */
const AnalyticsInputSchema = z
  .object({
    preset: z.enum(DATE_RANGE_PRESETS).optional(),
    startDate: z.number().int().min(0).optional(),
    endDate: z.number().int().min(0).optional(),
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
  )
  .refine(
    (data) => {
      if (data.preset === "custom" && data.startDate !== undefined && data.endDate !== undefined) {
        return data.endDate - data.startDate <= MAX_ANALYTICS_CUSTOM_RANGE_MS;
      }
      return true;
    },
    { message: "Custom date range must not exceed 366 days" },
  );

/** Number of days per date range preset. */
const PRESET_DAYS: Record<
  Exclude<(typeof DATE_RANGE_PRESETS)[number], "custom" | "all-time">,
  number
> = {
  "last-7-days": 7,
  "last-30-days": 30,
  "last-90-days": 90,
  "last-year": 365,
};

function toDateRangeFilter(input: z.infer<typeof AnalyticsInputSchema>): DateRangeFilter {
  const now = Date.now();
  const preset = input.preset ?? "last-30-days";

  if (preset === "all-time") {
    return {
      preset: "all-time",
      start: Math.max(0, now - MAX_ANALYTICS_CUSTOM_RANGE_MS) as UnixMillis,
      end: now as UnixMillis,
    };
  }

  if (preset === "custom") {
    if (input.startDate === undefined || input.endDate === undefined) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "VALIDATION_ERROR",
        "startDate and endDate are required for custom preset",
      );
    }
    return {
      preset: "custom",
      start: input.startDate as UnixMillis,
      end: input.endDate as UnixMillis,
    };
  }

  const days = PRESET_DAYS[preset];
  return {
    preset,
    start: (now - days * MS_PER_DAY) as UnixMillis,
    end: now as UnixMillis,
  };
}

export const analyticsRouter = router({
  fronting: systemProcedure.input(AnalyticsInputSchema).query(async ({ ctx, input }) => {
    const dateRange = toDateRangeFilter(input);
    return computeFrontingBreakdown(ctx.db, ctx.systemId, ctx.auth, dateRange);
  }),

  coFronting: systemProcedure.input(AnalyticsInputSchema).query(async ({ ctx, input }) => {
    const dateRange = toDateRangeFilter(input);
    return computeCoFrontingBreakdown(ctx.db, ctx.systemId, ctx.auth, dateRange);
  }),
});
