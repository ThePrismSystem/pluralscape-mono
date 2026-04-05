import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptStructureEntity,
  decryptStructureEntityPage,
} from "@pluralscape/data/transforms/structure-entity";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { rowToStructureEntity } from "../data/row-transforms.js";
import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import {
  DEFAULT_LIST_LIMIT,
  type DataListQuery,
  type DataQuery,
  type SystemIdOverride,
  type TRPCMutation,
  type TRPCQuery,
} from "./types.js";
import { useLocalDb, useQuerySource } from "./use-query-source.js";

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
import type { InfiniteData } from "@tanstack/react-query";

type StructureEntityPage = {
  readonly data: (StructureEntityDecrypted | Archived<StructureEntityDecrypted>)[];
  readonly nextCursor: string | null;
};

interface StructureEntityListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly entityTypeId?: SystemStructureEntityTypeId;
}

export function useStructureEntity(
  entityId: SystemStructureEntityId,
  opts?: SystemIdOverride,
): DataQuery<StructureEntityDecrypted | Archived<StructureEntityDecrypted>> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectEntity = useCallback(
    (raw: StructureEntityRaw): StructureEntityDecrypted | Archived<StructureEntityDecrypted> => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptStructureEntity(raw, masterKey);
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["structure_entities", entityId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const row = localDb.queryOne("SELECT * FROM structure_entities WHERE id = ?", [entityId]);
      if (!row) throw new Error("Structure entity not found");
      return rowToStructureEntity(row);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.structure.entity.get.useQuery(
    { systemId, entityId },
    {
      enabled: source === "remote" && masterKey !== null,
      select: selectEntity,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
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
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectPage = useCallback(
    (data: InfiniteData<StructureEntityRawPage>): InfiniteData<StructureEntityPage> => {
      if (masterKey === null) throw new Error("masterKey is null");
      const key = masterKey;
      return {
        ...data,
        pages: data.pages.map((page) => decryptStructureEntityPage(page, key)),
      };
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: [
      "structure_entities",
      "list",
      systemId,
      opts?.includeArchived ?? false,
      opts?.entityTypeId,
    ],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const includeArchived = opts?.includeArchived ?? false;
      let sql = includeArchived
        ? "SELECT * FROM structure_entities WHERE system_id = ? ORDER BY sort_order ASC"
        : "SELECT * FROM structure_entities WHERE system_id = ? AND archived = 0 ORDER BY sort_order ASC";
      const params: unknown[] = [systemId];
      if (opts?.entityTypeId !== undefined) {
        sql += " AND entity_type_id = ?";
        params.push(opts.entityTypeId);
      }
      return localDb.queryAll(sql, params).map(rowToStructureEntity);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.structure.entity.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
      entityTypeId: opts?.entityTypeId,
    },
    {
      enabled: source === "remote" && masterKey !== null,
      getNextPageParam: (lastPage: StructureEntityRawPage) => lastPage.nextCursor,
      select: selectPage,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useCreateStructureEntity(): TRPCMutation<
  RouterOutput["structure"]["entity"]["create"],
  RouterInput["structure"]["entity"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.structure.entity.create.useMutation({
    onSuccess: () => {
      void utils.structure.entity.list.invalidate({ systemId });
    },
  });
}

export function useUpdateStructureEntity(): TRPCMutation<
  RouterOutput["structure"]["entity"]["update"],
  RouterInput["structure"]["entity"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.structure.entity.update.useMutation({
    onSuccess: (_data, variables) => {
      void utils.structure.entity.get.invalidate({ systemId, entityId: variables.entityId });
      void utils.structure.entity.list.invalidate({ systemId });
    },
  });
}

export function useArchiveStructureEntity(): TRPCMutation<
  RouterOutput["structure"]["entity"]["archive"],
  RouterInput["structure"]["entity"]["archive"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.structure.entity.archive.useMutation({
    onSuccess: (_data, variables) => {
      void utils.structure.entity.get.invalidate({ systemId, entityId: variables.entityId });
      void utils.structure.entity.list.invalidate({ systemId });
    },
  });
}

export function useRestoreStructureEntity(): TRPCMutation<
  RouterOutput["structure"]["entity"]["restore"],
  RouterInput["structure"]["entity"]["restore"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.structure.entity.restore.useMutation({
    onSuccess: (_data, variables) => {
      void utils.structure.entity.get.invalidate({ systemId, entityId: variables.entityId });
      void utils.structure.entity.list.invalidate({ systemId });
    },
  });
}

export function useDeleteStructureEntity(): TRPCMutation<
  RouterOutput["structure"]["entity"]["delete"],
  RouterInput["structure"]["entity"]["delete"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.structure.entity.delete.useMutation({
    onSuccess: (_data, variables) => {
      void utils.structure.entity.get.invalidate({ systemId, entityId: variables.entityId });
      void utils.structure.entity.list.invalidate({ systemId });
      // Cross-resource: cascade removes dependent links
      void utils.structure.link.list.invalidate({ systemId });
      void utils.structure.memberLink.list.invalidate({ systemId });
    },
  });
}
