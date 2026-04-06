import { trpc } from "@pluralscape/api-client/trpc";
import { decryptInnerWorldRegion } from "@pluralscape/data/transforms/innerworld-region";

import { rowToInnerWorldRegion } from "../data/row-transforms/index.js";

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
  InnerWorldRegionDecrypted,
  InnerWorldRegionPage as InnerWorldRegionRawPage,
  InnerWorldRegionRaw,
} from "@pluralscape/data/transforms/innerworld-region";
import type { Archived, InnerWorldRegionId } from "@pluralscape/types";

interface InnerWorldRegionListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function useInnerWorldRegion(
  regionId: InnerWorldRegionId,
  opts?: SystemIdOverride,
): DataQuery<InnerWorldRegionDecrypted | Archived<InnerWorldRegionDecrypted>> {
  return useOfflineFirstQuery<
    InnerWorldRegionRaw,
    InnerWorldRegionDecrypted | Archived<InnerWorldRegionDecrypted>
  >({
    queryKey: ["innerworld_regions", regionId],
    table: "innerworld_regions",
    entityId: regionId,
    rowTransform: rowToInnerWorldRegion,
    decrypt: decryptInnerWorldRegion,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.innerworld.region.get.useQuery({ systemId, regionId }, { enabled, select }) as DataQuery<
        InnerWorldRegionDecrypted | Archived<InnerWorldRegionDecrypted>
      >,
  });
}

export function useInnerWorldRegionsList(
  opts?: InnerWorldRegionListOpts,
): DataListQuery<InnerWorldRegionDecrypted | Archived<InnerWorldRegionDecrypted>> {
  return useOfflineFirstInfiniteQuery<
    InnerWorldRegionRaw,
    InnerWorldRegionDecrypted | Archived<InnerWorldRegionDecrypted>
  >({
    queryKey: ["innerworld_regions", "list", opts?.includeArchived ?? false],
    table: "innerworld_regions",
    rowTransform: rowToInnerWorldRegion,
    decrypt: decryptInnerWorldRegion,
    includeArchived: opts?.includeArchived,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.innerworld.region.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
          includeArchived: opts?.includeArchived ?? false,
        },
        {
          enabled,
          getNextPageParam: (lastPage: InnerWorldRegionRawPage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<InnerWorldRegionDecrypted | Archived<InnerWorldRegionDecrypted>>,
  });
}

export function useCreateInnerWorldRegion(): TRPCMutation<
  RouterOutput["innerworld"]["region"]["create"],
  RouterInput["innerworld"]["region"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.innerworld.region.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.innerworld.region.list.invalidate({ systemId });
    },
  });
}

export function useUpdateInnerWorldRegion(): TRPCMutation<
  RouterOutput["innerworld"]["region"]["update"],
  RouterInput["innerworld"]["region"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.innerworld.region.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.innerworld.region.get.invalidate({ systemId, regionId: variables.regionId });
      void utils.innerworld.region.list.invalidate({ systemId });
    },
  });
}

export function useArchiveInnerWorldRegion(): TRPCMutation<
  RouterOutput["innerworld"]["region"]["archive"],
  RouterInput["innerworld"]["region"]["archive"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.innerworld.region.archive.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.innerworld.region.get.invalidate({ systemId, regionId: variables.regionId });
      void utils.innerworld.region.list.invalidate({ systemId });
    },
  });
}

export function useRestoreInnerWorldRegion(): TRPCMutation<
  RouterOutput["innerworld"]["region"]["restore"],
  RouterInput["innerworld"]["region"]["restore"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.innerworld.region.restore.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.innerworld.region.get.invalidate({ systemId, regionId: variables.regionId });
      void utils.innerworld.region.list.invalidate({ systemId });
    },
  });
}

export function useDeleteInnerWorldRegion(): TRPCMutation<
  RouterOutput["innerworld"]["region"]["delete"],
  RouterInput["innerworld"]["region"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.innerworld.region.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.innerworld.region.get.invalidate({ systemId, regionId: variables.regionId });
      void utils.innerworld.region.list.invalidate({ systemId });
    },
  });
}
