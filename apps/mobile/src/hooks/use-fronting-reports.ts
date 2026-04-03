import { trpc } from "@pluralscape/api-client/trpc";
import { decryptFrontingReport } from "@pluralscape/data/transforms/fronting-report";

import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import type { AppRouter, RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type { FrontingReport, FrontingReportId, SystemId } from "@pluralscape/types";
import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseMutationResult,
  UseQueryResult,
} from "@tanstack/react-query";
import type { TRPCClientErrorLike } from "@trpc/client";
import type { TRPCHookResult } from "@trpc/react-query/shared";

/** Default page size for fronting report list queries. */
const DEFAULT_LIST_LIMIT = 20;

type RawReport = RouterOutput["frontingReport"]["get"];
type RawReportPage = RouterOutput["frontingReport"]["list"];
type TRPCError = TRPCClientErrorLike<AppRouter>;
type ReportPage = { readonly items: FrontingReport[]; readonly nextCursor: string | null };
type TRPCQuery<T> = TRPCHookResult & UseQueryResult<T, TRPCError>;
type TRPCInfiniteQuery<T> = TRPCHookResult & UseInfiniteQueryResult<InfiniteData<T>, TRPCError>;
type TRPCMutation<TData, TVars> = TRPCHookResult & UseMutationResult<TData, TRPCError, TVars>;

interface SystemIdOverride {
  readonly systemId?: SystemId;
}

interface FrontingReportListOpts extends SystemIdOverride {
  readonly limit?: number;
}

export function useFrontingReport(
  reportId: FrontingReportId,
  opts?: SystemIdOverride,
): TRPCQuery<FrontingReport> {
  const systemId = opts?.systemId ?? useActiveSystemId();
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
  const systemId = opts?.systemId ?? useActiveSystemId();
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
            items: page.data.map((item) => decryptFrontingReport(item, key)),
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
