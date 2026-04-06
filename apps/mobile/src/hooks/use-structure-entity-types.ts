import { trpc } from "@pluralscape/api-client/trpc";
import { decryptStructureEntityType } from "@pluralscape/data/transforms/structure-entity-type";

import { rowToStructureEntityType } from "../data/row-transforms.js";

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
  StructureEntityTypeDecrypted,
  StructureEntityTypePage as StructureEntityTypeRawPage,
  StructureEntityTypeRaw,
} from "@pluralscape/data/transforms/structure-entity-type";
import type { Archived, SystemStructureEntityTypeId } from "@pluralscape/types";

interface StructureEntityTypeListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function useStructureEntityType(
  entityTypeId: SystemStructureEntityTypeId,
  opts?: SystemIdOverride,
): DataQuery<StructureEntityTypeDecrypted | Archived<StructureEntityTypeDecrypted>> {
  return useOfflineFirstQuery<
    StructureEntityTypeRaw,
    StructureEntityTypeDecrypted | Archived<StructureEntityTypeDecrypted>
  >({
    queryKey: ["structure_entity_types", entityTypeId],
    table: "structure_entity_types",
    entityId: entityTypeId,
    rowTransform: rowToStructureEntityType,
    decrypt: decryptStructureEntityType,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.structure.entityType.get.useQuery(
        { systemId, entityTypeId },
        { enabled, select },
      ) as DataQuery<StructureEntityTypeDecrypted | Archived<StructureEntityTypeDecrypted>>,
  });
}

export function useStructureEntityTypesList(
  opts?: StructureEntityTypeListOpts,
): DataListQuery<StructureEntityTypeDecrypted | Archived<StructureEntityTypeDecrypted>> {
  return useOfflineFirstInfiniteQuery<
    StructureEntityTypeRaw,
    StructureEntityTypeDecrypted | Archived<StructureEntityTypeDecrypted>
  >({
    queryKey: ["structure_entity_types", "list", opts?.systemId, opts?.includeArchived ?? false],
    table: "structure_entity_types",
    rowTransform: rowToStructureEntityType,
    decrypt: decryptStructureEntityType,
    includeArchived: opts?.includeArchived,
    systemIdOverride: opts,
    localQueryFn: (localDb, systemId) => {
      const includeArchived = opts?.includeArchived ?? false;
      const sql = includeArchived
        ? "SELECT * FROM structure_entity_types WHERE system_id = ? ORDER BY sort_order ASC"
        : "SELECT * FROM structure_entity_types WHERE system_id = ? AND archived = 0 ORDER BY sort_order ASC";
      return localDb.queryAll(sql, [systemId]).map(rowToStructureEntityType);
    },
    useRemote: ({ systemId, enabled, select }) =>
      trpc.structure.entityType.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
          includeArchived: opts?.includeArchived ?? false,
        },
        {
          enabled,
          getNextPageParam: (lastPage: StructureEntityTypeRawPage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<StructureEntityTypeDecrypted | Archived<StructureEntityTypeDecrypted>>,
  });
}

export function useCreateStructureEntityType(): TRPCMutation<
  RouterOutput["structure"]["entityType"]["create"],
  RouterInput["structure"]["entityType"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.structure.entityType.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.structure.entityType.list.invalidate({ systemId });
    },
  });
}

export function useUpdateStructureEntityType(): TRPCMutation<
  RouterOutput["structure"]["entityType"]["update"],
  RouterInput["structure"]["entityType"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.structure.entityType.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.structure.entityType.get.invalidate({
        systemId,
        entityTypeId: variables.entityTypeId,
      });
      void utils.structure.entityType.list.invalidate({ systemId });
    },
  });
}

export function useArchiveStructureEntityType(): TRPCMutation<
  RouterOutput["structure"]["entityType"]["archive"],
  RouterInput["structure"]["entityType"]["archive"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.structure.entityType.archive.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.structure.entityType.get.invalidate({
        systemId,
        entityTypeId: variables.entityTypeId,
      });
      void utils.structure.entityType.list.invalidate({ systemId });
    },
  });
}

export function useRestoreStructureEntityType(): TRPCMutation<
  RouterOutput["structure"]["entityType"]["restore"],
  RouterInput["structure"]["entityType"]["restore"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.structure.entityType.restore.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.structure.entityType.get.invalidate({
        systemId,
        entityTypeId: variables.entityTypeId,
      });
      void utils.structure.entityType.list.invalidate({ systemId });
    },
  });
}

export function useDeleteStructureEntityType(): TRPCMutation<
  RouterOutput["structure"]["entityType"]["delete"],
  RouterInput["structure"]["entityType"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.structure.entityType.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.structure.entityType.get.invalidate({
        systemId,
        entityTypeId: variables.entityTypeId,
      });
      void utils.structure.entityType.list.invalidate({ systemId });
      // Cascade: deleting a type removes its entities
      void utils.structure.entity.list.invalidate({ systemId });
    },
  });
}
