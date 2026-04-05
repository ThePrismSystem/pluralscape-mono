import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptStructureEntityType,
  decryptStructureEntityTypePage,
} from "@pluralscape/data/transforms/structure-entity-type";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { rowToStructureEntityType } from "../data/row-transforms.js";
import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import {
  DEFAULT_LIST_LIMIT,
  type DataListQuery,
  type DataQuery,
  type SystemIdOverride,
  type TRPCMutation,
} from "./types.js";
import { useLocalDb, useQuerySource } from "./use-query-source.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  StructureEntityTypeDecrypted,
  StructureEntityTypePage as StructureEntityTypeRawPage,
  StructureEntityTypeRaw,
} from "@pluralscape/data/transforms/structure-entity-type";
import type { Archived, SystemStructureEntityTypeId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type StructureEntityTypePage = {
  readonly data: (StructureEntityTypeDecrypted | Archived<StructureEntityTypeDecrypted>)[];
  readonly nextCursor: string | null;
};

interface StructureEntityTypeListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function useStructureEntityType(
  entityTypeId: SystemStructureEntityTypeId,
  opts?: SystemIdOverride,
): DataQuery<StructureEntityTypeDecrypted | Archived<StructureEntityTypeDecrypted>> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectEntityType = useCallback(
    (
      raw: StructureEntityTypeRaw,
    ): StructureEntityTypeDecrypted | Archived<StructureEntityTypeDecrypted> => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptStructureEntityType(raw, masterKey);
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["structure_entity_types", entityTypeId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const row = localDb.queryOne("SELECT * FROM structure_entity_types WHERE id = ?", [
        entityTypeId,
      ]);
      if (!row) throw new Error("Structure entity type not found");
      return rowToStructureEntityType(row);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.structure.entityType.get.useQuery(
    { systemId, entityTypeId },
    {
      enabled: source === "remote" && masterKey !== null,
      select: selectEntityType,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useStructureEntityTypesList(
  opts?: StructureEntityTypeListOpts,
): DataListQuery<StructureEntityTypeDecrypted | Archived<StructureEntityTypeDecrypted>> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectPage = useCallback(
    (data: InfiniteData<StructureEntityTypeRawPage>): InfiniteData<StructureEntityTypePage> => {
      if (masterKey === null) throw new Error("masterKey is null");
      const key = masterKey;
      return {
        ...data,
        pages: data.pages.map((page) => decryptStructureEntityTypePage(page, key)),
      };
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["structure_entity_types", "list", systemId, opts?.includeArchived ?? false],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const includeArchived = opts?.includeArchived ?? false;
      const sql = includeArchived
        ? "SELECT * FROM structure_entity_types WHERE system_id = ? ORDER BY sort_order ASC"
        : "SELECT * FROM structure_entity_types WHERE system_id = ? AND archived = 0 ORDER BY sort_order ASC";
      return localDb.queryAll(sql, [systemId]).map(rowToStructureEntityType);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.structure.entityType.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: source === "remote" && masterKey !== null,
      getNextPageParam: (lastPage: StructureEntityTypeRawPage) => lastPage.nextCursor,
      select: selectPage,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useCreateStructureEntityType(): TRPCMutation<
  RouterOutput["structure"]["entityType"]["create"],
  RouterInput["structure"]["entityType"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.structure.entityType.create.useMutation({
    onSuccess: () => {
      void utils.structure.entityType.list.invalidate({ systemId });
    },
  });
}

export function useUpdateStructureEntityType(): TRPCMutation<
  RouterOutput["structure"]["entityType"]["update"],
  RouterInput["structure"]["entityType"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.structure.entityType.update.useMutation({
    onSuccess: (_data, variables) => {
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
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.structure.entityType.archive.useMutation({
    onSuccess: (_data, variables) => {
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
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.structure.entityType.restore.useMutation({
    onSuccess: (_data, variables) => {
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
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.structure.entityType.delete.useMutation({
    onSuccess: (_data, variables) => {
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
