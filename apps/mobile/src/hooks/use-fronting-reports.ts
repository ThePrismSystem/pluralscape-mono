import { trpc } from "@pluralscape/api-client/trpc";
import { decryptFrontingReport } from "@pluralscape/data/transforms/fronting-report";

import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import {
  DEFAULT_LIST_LIMIT,
  type SystemIdOverride,
  type TRPCInfiniteQuery,
  type TRPCMutation,
  type TRPCQuery,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type { FrontingReport, FrontingReportId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type RawReport = RouterOutput["frontingReport"]["get"];
type RawReportPage = RouterOutput["frontingReport"]["list"];
type ReportPage = { readonly data: FrontingReport[]; readonly nextCursor: string | null };

interface FrontingReportListOpts extends SystemIdOverride {
  readonly limit?: number;
}

export function useFrontingReport(
  reportId: FrontingReportId,
  opts?: SystemIdOverride,
): TRPCQuery<FrontingReport> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  return trpc.frontingReport.get.useQuery(
    { systemId, reportId },
    {
      enabled: masterKey !== null,
      select: (raw: RawReport): FrontingReport => {
        if (masterKey === null) throw new Error("masterKey is null");
        return decryptFrontingReport(raw, masterKey);
      },
    },
  );
}

export function useFrontingReportsList(
  opts?: FrontingReportListOpts,
): TRPCInfiniteQuery<ReportPage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  return trpc.frontingReport.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: RawReportPage) => lastPage.nextCursor,
      select: (data: InfiniteData<RawReportPage>): InfiniteData<ReportPage> => {
        if (masterKey === null) throw new Error("masterKey is null");
        const key = masterKey;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            data: page.data.map((item) => decryptFrontingReport(item, key)),
            nextCursor: page.nextCursor,
          })),
        };
      },
    },
  );
}

export function useGenerateReport(): TRPCMutation<
  RouterOutput["frontingReport"]["create"],
  RouterInput["frontingReport"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.frontingReport.create.useMutation({
    onSuccess: () => {
      void utils.frontingReport.list.invalidate({ systemId });
    },
  });
}

export function useDeleteReport(): TRPCMutation<
  RouterOutput["frontingReport"]["delete"],
  RouterInput["frontingReport"]["delete"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.frontingReport.delete.useMutation({
    onSuccess: (_data, variables) => {
      void utils.frontingReport.get.invalidate({ systemId, reportId: variables.reportId });
      void utils.frontingReport.list.invalidate({ systemId });
    },
  });
}
