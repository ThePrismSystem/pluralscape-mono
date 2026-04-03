import { trpc } from "@pluralscape/api-client/trpc";
import {
  toCoFrontingAnalytics,
  toFrontingAnalytics,
} from "@pluralscape/data/transforms/fronting-analytics";

import { useActiveSystemId } from "../providers/system-provider.js";

import { type TRPCQuery } from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type { CoFrontingAnalytics, FrontingAnalytics } from "@pluralscape/types";

/** Analytics data is treated as fresh for 5 minutes. */
const ANALYTICS_STALE_TIME = 300_000;

type AnalyticsInput = Omit<RouterInput["analytics"]["fronting"], "systemId">;

export function useFrontingAnalytics(opts?: AnalyticsInput): TRPCQuery<FrontingAnalytics> {
  const systemId = useActiveSystemId();

  return trpc.analytics.fronting.useQuery(
    {
      systemId,
      preset: opts?.preset,
      startDate: opts?.startDate,
      endDate: opts?.endDate,
    },
    {
      staleTime: ANALYTICS_STALE_TIME,
      select: (raw: RouterOutput["analytics"]["fronting"]): FrontingAnalytics =>
        toFrontingAnalytics(raw),
    },
  );
}

export function useCoFrontingAnalytics(opts?: AnalyticsInput): TRPCQuery<CoFrontingAnalytics> {
  const systemId = useActiveSystemId();

  return trpc.analytics.coFronting.useQuery(
    {
      systemId,
      preset: opts?.preset,
      startDate: opts?.startDate,
      endDate: opts?.endDate,
    },
    {
      staleTime: ANALYTICS_STALE_TIME,
      select: (raw: RouterOutput["analytics"]["coFronting"]): CoFrontingAnalytics =>
        toCoFrontingAnalytics(raw),
    },
  );
}
