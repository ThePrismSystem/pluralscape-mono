import { trpc } from "@pluralscape/api-client/trpc";
import { decryptStructureEntity } from "@pluralscape/data/transforms/structure-entity";

import { rowToStructureEntity } from "../data/row-transforms/index.js";
import { useActiveSystemId } from "../providers/system-provider.js";

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
  type TRPCQuery,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  StructureEntityDecrypted,
  StructureEntityPage as StructureEntityRawPage,
  StructureEntityRaw,
} from "@pluralscape/data/transforms/structure-entity";
import type {
  Archived,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
} from "@pluralscape/types";

interface StructureEntityListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly entityTypeId?: SystemStructureEntityTypeId;
}

export function useStructureEntity(
  entityId: SystemStructureEntityId,
  opts?: SystemIdOverride,
): DataQuery<StructureEntityDecrypted | Archived<StructureEntityDecrypted>> {
  return useOfflineFirstQuery<
    StructureEntityRaw,
    StructureEntityDecrypted | Archived<StructureEntityDecrypted>
  >({
    queryKey: ["structure_entities", entityId],
    table: "structure_entities",
    entityId,
    rowTransform: rowToStructureEntity,
    decrypt: decryptStructureEntity,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.structure.entity.get.useQuery({ systemId, entityId }, { enabled, select }) as DataQuery<
        StructureEntityDecrypted | Archived<StructureEntityDecrypted>
      >,
  });
}

export function useStructureEntityHierarchy(
  entityId: SystemStructureEntityId,
  opts?: SystemIdOverride,
): TRPCQuery<RouterOutput["structure"]["entity"]["getHierarchy"]> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  return trpc.structure.entity.getHierarchy.useQuery({ systemId, entityId });
}

export function useStructureEntitiesList(
  opts?: StructureEntityListOpts,
): DataListQuery<StructureEntityDecrypted | Archived<StructureEntityDecrypted>> {
  return useOfflineFirstInfiniteQuery<
    StructureEntityRaw,
    StructureEntityDecrypted | Archived<StructureEntityDecrypted>
  >({
    queryKey: ["structure_entities", "list", opts?.includeArchived ?? false, opts?.entityTypeId],
    table: "structure_entities",
    rowTransform: rowToStructureEntity,
    decrypt: decryptStructureEntity,
    includeArchived: opts?.includeArchived,
    systemIdOverride: opts,
    localQueryFn: async (localDb, systemId, pagination) => {
      const includeArchived = opts?.includeArchived ?? false;
      const archived = includeArchived ? "" : " AND archived = 0";
      let sql = `SELECT * FROM structure_entities WHERE system_id = ?${archived}`;
      const params: unknown[] = [systemId];
      if (opts?.entityTypeId !== undefined) {
        sql += " AND entity_type_id = ?";
        params.push(opts.entityTypeId);
      }
      sql += ` ORDER BY sort_order ASC LIMIT ${String(pagination.limit)} OFFSET ${String(pagination.offset)}`;
      const rows = await localDb.queryAll(sql, params);
      return rows.map(rowToStructureEntity);
    },
    useRemote: ({ systemId, enabled, select }) =>
      trpc.structure.entity.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
          includeArchived: opts?.includeArchived ?? false,
          entityTypeId: opts?.entityTypeId,
        },
        {
          enabled,
          getNextPageParam: (lastPage: StructureEntityRawPage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<StructureEntityDecrypted | Archived<StructureEntityDecrypted>>,
  });
}

export function useCreateStructureEntity(): TRPCMutation<
  RouterOutput["structure"]["entity"]["create"],
  RouterInput["structure"]["entity"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.structure.entity.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.structure.entity.list.invalidate({ systemId });
    },
  });
}

export function useUpdateStructureEntity(): TRPCMutation<
  RouterOutput["structure"]["entity"]["update"],
  RouterInput["structure"]["entity"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.structure.entity.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.structure.entity.get.invalidate({ systemId, entityId: variables.entityId });
      void utils.structure.entity.list.invalidate({ systemId });
    },
  });
}

export function useArchiveStructureEntity(): TRPCMutation<
  RouterOutput["structure"]["entity"]["archive"],
  RouterInput["structure"]["entity"]["archive"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.structure.entity.archive.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.structure.entity.get.invalidate({ systemId, entityId: variables.entityId });
      void utils.structure.entity.list.invalidate({ systemId });
    },
  });
}

export function useRestoreStructureEntity(): TRPCMutation<
  RouterOutput["structure"]["entity"]["restore"],
  RouterInput["structure"]["entity"]["restore"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.structure.entity.restore.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.structure.entity.get.invalidate({ systemId, entityId: variables.entityId });
      void utils.structure.entity.list.invalidate({ systemId });
    },
  });
}

export function useDeleteStructureEntity(): TRPCMutation<
  RouterOutput["structure"]["entity"]["delete"],
  RouterInput["structure"]["entity"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.structure.entity.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.structure.entity.get.invalidate({ systemId, entityId: variables.entityId });
      void utils.structure.entity.list.invalidate({ systemId });
      // Cross-resource: cascade removes dependent links
      void utils.structure.link.list.invalidate({ systemId });
      void utils.structure.memberLink.list.invalidate({ systemId });
    },
  });
}
