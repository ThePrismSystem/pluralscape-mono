import { trpc } from "@pluralscape/api-client/trpc";
import { decryptCustomFront } from "@pluralscape/data/transforms/custom-front";

import { rowToCustomFront } from "../data/row-transforms/index.js";

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
  CustomFrontPage as CustomFrontRawPage,
  CustomFrontRaw,
} from "@pluralscape/data/transforms/custom-front";
import type { Archived, CustomFront, CustomFrontId } from "@pluralscape/types";

interface CustomFrontListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function useCustomFront(
  customFrontId: CustomFrontId,
  opts?: SystemIdOverride,
): DataQuery<CustomFront | Archived<CustomFront>> {
  return useOfflineFirstQuery<CustomFrontRaw, CustomFront | Archived<CustomFront>>({
    queryKey: ["custom_fronts", customFrontId],
    table: "custom_fronts",
    entityId: customFrontId,
    rowTransform: rowToCustomFront,
    decrypt: decryptCustomFront,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.customFront.get.useQuery({ systemId, customFrontId }, { enabled, select }) as DataQuery<
        CustomFront | Archived<CustomFront>
      >,
  });
}

export function useCustomFrontsList(
  opts?: CustomFrontListOpts,
): DataListQuery<CustomFront | Archived<CustomFront>> {
  return useOfflineFirstInfiniteQuery<CustomFrontRaw, CustomFront | Archived<CustomFront>>({
    queryKey: ["custom_fronts", "list", opts?.includeArchived ?? false],
    table: "custom_fronts",
    rowTransform: rowToCustomFront,
    decrypt: decryptCustomFront,
    includeArchived: opts?.includeArchived,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.customFront.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
        },
        {
          enabled,
          getNextPageParam: (lastPage: CustomFrontRawPage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<CustomFront | Archived<CustomFront>>,
  });
}

export function useCreateCustomFront(): TRPCMutation<
  RouterOutput["customFront"]["create"],
  RouterInput["customFront"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.customFront.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.customFront.list.invalidate({ systemId });
    },
  });
}

export function useUpdateCustomFront(): TRPCMutation<
  RouterOutput["customFront"]["update"],
  RouterInput["customFront"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.customFront.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.customFront.get.invalidate({ systemId, customFrontId: variables.customFrontId });
      void utils.customFront.list.invalidate({ systemId });
    },
  });
}

export function useArchiveCustomFront(): TRPCMutation<
  RouterOutput["customFront"]["archive"],
  RouterInput["customFront"]["archive"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.customFront.archive.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.customFront.get.invalidate({ systemId, customFrontId: variables.customFrontId });
      void utils.customFront.list.invalidate({ systemId });
    },
  });
}

export function useRestoreCustomFront(): TRPCMutation<
  RouterOutput["customFront"]["restore"],
  RouterInput["customFront"]["restore"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.customFront.restore.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.customFront.get.invalidate({ systemId, customFrontId: variables.customFrontId });
      void utils.customFront.list.invalidate({ systemId });
    },
  });
}

export function useDeleteCustomFront(): TRPCMutation<
  RouterOutput["customFront"]["delete"],
  RouterInput["customFront"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.customFront.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.customFront.get.invalidate({ systemId, customFrontId: variables.customFrontId });
      void utils.customFront.list.invalidate({ systemId });
    },
  });
}
