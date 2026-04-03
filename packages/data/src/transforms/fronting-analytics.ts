import type { CoFrontingAnalytics, FrontingAnalytics } from "@pluralscape/types";

/**
 * Fronting analytics transforms.
 *
 * Analytics are T3 — server-side aggregations returned as plain JSON with no
 * encrypted fields. These functions type-narrow the raw tRPC output to the
 * canonical domain types.
 */

/** Type-narrow the raw tRPC output to FrontingAnalytics. */
export function toFrontingAnalytics(raw: FrontingAnalytics): FrontingAnalytics {
  return raw;
}

/** Type-narrow the raw tRPC output to CoFrontingAnalytics. */
export function toCoFrontingAnalytics(raw: CoFrontingAnalytics): CoFrontingAnalytics {
  return raw;
}
