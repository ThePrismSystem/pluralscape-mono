import { trpc } from "@pluralscape/api-client/trpc";
import { decryptInnerWorldEntity } from "@pluralscape/data/transforms/innerworld-entity";

import { rowToInnerWorldEntity } from "../data/row-transforms.js";

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
  InnerWorldEntityDecrypted,
  InnerWorldEntityPage as InnerWorldEntityRawPage,
  InnerWorldEntityRaw,
} from "@pluralscape/data/transforms/innerworld-entity";
import type { Archived, InnerWorldEntityId, InnerWorldRegionId } from "@pluralscape/types";

interface InnerWorldEntityListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly regionId?: InnerWorldRegionId;
}

export function useInnerWorldEntity(
  entityId: InnerWorldEntityId,
  opts?: SystemIdOverride,
): DataQuery<InnerWorldEntityDecrypted | Archived<InnerWorldEntityDecrypted>> {
  return useOfflineFirstQuery<
    InnerWorldEntityRaw,
    InnerWorldEntityDecrypted | Archived<InnerWorldEntityDecrypted>
  >({
    queryKey: ["innerworld-entities", entityId],
    table: "innerworld_entities",
    entityId,
    rowTransform: rowToInnerWorldEntity,
    decrypt: decryptInnerWorldEntity,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.innerworld.entity.get.useQuery({ systemId, entityId }, { enabled, select }) as DataQuery<
        InnerWorldEntityDecrypted | Archived<InnerWorldEntityDecrypted>
      >,
  });
}

export function useInnerWorldEntitiesList(
  opts?: InnerWorldEntityListOpts,
): DataListQuery<InnerWorldEntityDecrypted | Archived<InnerWorldEntityDecrypted>> {
  const regionId = opts?.regionId ?? null;

  return useOfflineFirstInfiniteQuery<
    InnerWorldEntityRaw,
    InnerWorldEntityDecrypted | Archived<InnerWorldEntityDecrypted>
  >({
    queryKey: ["innerworld-entities", "list", opts?.includeArchived ?? false, regionId],
    table: "innerworld_entities",
    rowTransform: rowToInnerWorldEntity,
    decrypt: decryptInnerWorldEntity,
    includeArchived: opts?.includeArchived,
    systemIdOverride: opts,
    // Optional regionId filter requires a custom local query
    localQueryFn:
      regionId !== null
        ? (localDb, systemId) => {
            const includeArchived = opts?.includeArchived ?? false;
            const sql = includeArchived
              ? "SELECT * FROM innerworld_entities WHERE system_id = ? AND region_id = ? ORDER BY created_at DESC"
              : "SELECT * FROM innerworld_entities WHERE system_id = ? AND region_id = ? AND archived = 0 ORDER BY created_at DESC";
            return localDb.queryAll(sql, [systemId, regionId]).map(rowToInnerWorldEntity);
          }
        : undefined,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.innerworld.entity.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
          includeArchived: opts?.includeArchived ?? false,
          regionId: opts?.regionId,
        },
        {
          enabled,
          getNextPageParam: (lastPage: InnerWorldEntityRawPage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<InnerWorldEntityDecrypted | Archived<InnerWorldEntityDecrypted>>,
  });
}

export function useCreateInnerWorldEntity(): TRPCMutation<
  RouterOutput["innerworld"]["entity"]["create"],
  RouterInput["innerworld"]["entity"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.innerworld.entity.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.innerworld.entity.list.invalidate({ systemId });
    },
  });
}

export function useUpdateInnerWorldEntity(): TRPCMutation<
  RouterOutput["innerworld"]["entity"]["update"],
  RouterInput["innerworld"]["entity"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.innerworld.entity.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.innerworld.entity.get.invalidate({ systemId, entityId: variables.entityId });
      void utils.innerworld.entity.list.invalidate({ systemId });
    },
  });
}

export function useArchiveInnerWorldEntity(): TRPCMutation<
  RouterOutput["innerworld"]["entity"]["archive"],
  RouterInput["innerworld"]["entity"]["archive"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.innerworld.entity.archive.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.innerworld.entity.get.invalidate({ systemId, entityId: variables.entityId });
      void utils.innerworld.entity.list.invalidate({ systemId });
    },
  });
}

export function useRestoreInnerWorldEntity(): TRPCMutation<
  RouterOutput["innerworld"]["entity"]["restore"],
  RouterInput["innerworld"]["entity"]["restore"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.innerworld.entity.restore.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.innerworld.entity.get.invalidate({ systemId, entityId: variables.entityId });
      void utils.innerworld.entity.list.invalidate({ systemId });
    },
  });
}

export function useDeleteInnerWorldEntity(): TRPCMutation<
  RouterOutput["innerworld"]["entity"]["delete"],
  RouterInput["innerworld"]["entity"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.innerworld.entity.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.innerworld.entity.get.invalidate({ systemId, entityId: variables.entityId });
      void utils.innerworld.entity.list.invalidate({ systemId });
    },
  });
}
