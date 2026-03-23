import { MS_PER_DAY } from "@pluralscape/types";
import { AnalyticsQuerySchema } from "@pluralscape/validation";

import { HTTP_BAD_REQUEST } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";

import type { DateRangeFilter, DateRangePreset, UnixMillis } from "@pluralscape/types";

/** Number of days per date range preset. */
const PRESET_DAYS: Record<Exclude<DateRangePreset, "custom" | "all-time">, number> = {
  "last-7-days": 7,
  "last-30-days": 30,
  "last-90-days": 90,
  "last-year": 365,
};

/**
 * Parse analytics query parameters into a DateRangeFilter.
 * Defaults to `last-30-days` when no preset is specified.
 */
export function parseAnalyticsQuery(query: Record<string, string | undefined>): DateRangeFilter {
  const result = AnalyticsQuerySchema.safeParse(query);
  if (!result.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid query parameters");
  }

  const now = Date.now();
  const preset = result.data.preset ?? "last-30-days";

  if (preset === "all-time") {
    return {
      preset: "all-time",
      start: 0 as UnixMillis,
      end: now as UnixMillis,
    };
  }

  if (preset === "custom") {
    return {
      preset: "custom",
      start: (result.data.startDate ?? 0) as UnixMillis,
      end: (result.data.endDate ?? now) as UnixMillis,
    };
  }

  const days = PRESET_DAYS[preset];
  return {
    preset,
    start: (now - days * MS_PER_DAY) as UnixMillis,
    end: now as UnixMillis,
  };
}
