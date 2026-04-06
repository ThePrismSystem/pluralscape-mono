import { trpc } from "@pluralscape/api-client/trpc";
import { decryptFrontingReport } from "@pluralscape/data/transforms/fronting-report";

import {
  useOfflineFirstQuery,
  useOfflineFirstInfiniteQuery,
  useDomainMutation,
} from "./factories.js";
import {
  DEFAULT_LIST_LIMIT,
  type DataListQuery,
  type DataQuery,
  type SystemIdOverride,
  type TRPCMutation,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  FrontingReportPage,
  FrontingReportRaw,
} from "@pluralscape/data/transforms/fronting-report";
import type { FrontingReport, FrontingReportId } from "@pluralscape/types";

interface FrontingReportListOpts extends SystemIdOverride {
  readonly limit?: number;
}

export function useFrontingReport(
  reportId: FrontingReportId,
  opts?: SystemIdOverride,
): DataQuery<FrontingReport> {
  return useOfflineFirstQuery<FrontingReportRaw, FrontingReport>({
    queryKey: ["fronting_reports", reportId],
    table: "fronting_reports",
    entityId: reportId,
    rowTransform: () => {
      throw new Error("fronting_reports are remote-only");
    },
    decrypt: decryptFrontingReport,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.frontingReport.get.useQuery(
        { systemId, reportId },
        { enabled, select },
      ) as DataQuery<FrontingReport>,
  });
}

export function useFrontingReportsList(
  opts?: FrontingReportListOpts,
): DataListQuery<FrontingReport> {
  return useOfflineFirstInfiniteQuery<FrontingReportRaw, FrontingReport>({
    queryKey: ["fronting_reports", "list"],
    table: "fronting_reports",
    rowTransform: () => {
      throw new Error("fronting_reports are remote-only");
    },
    decrypt: decryptFrontingReport,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.frontingReport.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
        },
        {
          enabled,
          getNextPageParam: (lastPage: FrontingReportPage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<FrontingReport>,
  });
}

export function useGenerateReport(): TRPCMutation<
  RouterOutput["frontingReport"]["create"],
  RouterInput["frontingReport"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.frontingReport.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.frontingReport.list.invalidate({ systemId });
    },
  });
}

export function useArchiveFrontingReport(): TRPCMutation<
  RouterOutput["frontingReport"]["archive"],
  RouterInput["frontingReport"]["archive"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.frontingReport.archive.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.frontingReport.get.invalidate({ systemId, reportId: variables.reportId });
      void utils.frontingReport.list.invalidate({ systemId });
    },
  });
}

export function useRestoreFrontingReport(): TRPCMutation<
  RouterOutput["frontingReport"]["restore"],
  RouterInput["frontingReport"]["restore"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.frontingReport.restore.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.frontingReport.get.invalidate({ systemId, reportId: variables.reportId });
      void utils.frontingReport.list.invalidate({ systemId });
    },
  });
}

export function useDeleteReport(): TRPCMutation<
  RouterOutput["frontingReport"]["delete"],
  RouterInput["frontingReport"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.frontingReport.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.frontingReport.get.invalidate({ systemId, reportId: variables.reportId });
      void utils.frontingReport.list.invalidate({ systemId });
    },
  });
}
