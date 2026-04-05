import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptInnerWorldEntity,
  decryptInnerWorldEntityPage,
} from "@pluralscape/data/transforms/innerworld-entity";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { rowToInnerWorldEntity } from "../data/row-transforms.js";
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
  InnerWorldEntityDecrypted,
  InnerWorldEntityPage as InnerWorldEntityRawPage,
  InnerWorldEntityRaw,
} from "@pluralscape/data/transforms/innerworld-entity";
import type { Archived, InnerWorldEntityId, InnerWorldRegionId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type InnerWorldEntityPage = {
  readonly data: (InnerWorldEntityDecrypted | Archived<InnerWorldEntityDecrypted>)[];
  readonly nextCursor: string | null;
};

interface InnerWorldEntityListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly regionId?: InnerWorldRegionId;
}

export function useInnerWorldEntity(
  entityId: InnerWorldEntityId,
  opts?: SystemIdOverride,
): DataQuery<InnerWorldEntityDecrypted | Archived<InnerWorldEntityDecrypted>> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectEntity = useCallback(
    (raw: InnerWorldEntityRaw): InnerWorldEntityDecrypted | Archived<InnerWorldEntityDecrypted> => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptInnerWorldEntity(raw, masterKey);
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["innerworld-entities", entityId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const row = localDb.queryOne("SELECT * FROM innerworld_entities WHERE id = ?", [entityId]);
      if (!row) throw new Error("InnerWorldEntity not found");
      return rowToInnerWorldEntity(row);
    },
    enabled: source === "local",
  });

  const remoteQuery = trpc.innerworld.entity.get.useQuery(
    { systemId, entityId },
    {
      enabled: source === "remote" && masterKey !== null,
      select: selectEntity,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useInnerWorldEntitiesList(
  opts?: InnerWorldEntityListOpts,
): DataListQuery<InnerWorldEntityDecrypted | Archived<InnerWorldEntityDecrypted>> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectPage = useCallback(
    (data: InfiniteData<InnerWorldEntityRawPage>): InfiniteData<InnerWorldEntityPage> => {
      if (masterKey === null) throw new Error("masterKey is null");
      const key = masterKey;
      return {
        ...data,
        pages: data.pages.map((page) => decryptInnerWorldEntityPage(page, key)),
      };
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: [
      "innerworld-entities",
      "list",
      systemId,
      opts?.includeArchived ?? false,
      opts?.regionId ?? null,
    ],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const includeArchived = opts?.includeArchived ?? false;
      const regionId = opts?.regionId ?? null;
      if (regionId !== null) {
        const sql = includeArchived
          ? "SELECT * FROM innerworld_entities WHERE system_id = ? AND region_id = ?"
          : "SELECT * FROM innerworld_entities WHERE system_id = ? AND region_id = ? AND archived = 0";
        return localDb.queryAll(sql, [systemId, regionId]).map(rowToInnerWorldEntity);
      }
      const sql = includeArchived
        ? "SELECT * FROM innerworld_entities WHERE system_id = ?"
        : "SELECT * FROM innerworld_entities WHERE system_id = ? AND archived = 0";
      return localDb.queryAll(sql, [systemId]).map(rowToInnerWorldEntity);
    },
    enabled: source === "local",
  });

  const remoteQuery = trpc.innerworld.entity.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
      regionId: opts?.regionId,
    },
    {
      enabled: source === "remote" && masterKey !== null,
      getNextPageParam: (lastPage: InnerWorldEntityRawPage) => lastPage.nextCursor,
      select: selectPage,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useCreateInnerWorldEntity(): TRPCMutation<
  RouterOutput["innerworld"]["entity"]["create"],
  RouterInput["innerworld"]["entity"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.innerworld.entity.create.useMutation({
    onSuccess: () => {
      void utils.innerworld.entity.list.invalidate({ systemId });
    },
  });
}

export function useUpdateInnerWorldEntity(): TRPCMutation<
  RouterOutput["innerworld"]["entity"]["update"],
  RouterInput["innerworld"]["entity"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.innerworld.entity.update.useMutation({
    onSuccess: (_data, variables) => {
      void utils.innerworld.entity.get.invalidate({ systemId, entityId: variables.entityId });
      void utils.innerworld.entity.list.invalidate({ systemId });
    },
  });
}

export function useArchiveInnerWorldEntity(): TRPCMutation<
  RouterOutput["innerworld"]["entity"]["archive"],
  RouterInput["innerworld"]["entity"]["archive"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.innerworld.entity.archive.useMutation({
    onSuccess: (_data, variables) => {
      void utils.innerworld.entity.get.invalidate({ systemId, entityId: variables.entityId });
      void utils.innerworld.entity.list.invalidate({ systemId });
    },
  });
}

export function useRestoreInnerWorldEntity(): TRPCMutation<
  RouterOutput["innerworld"]["entity"]["restore"],
  RouterInput["innerworld"]["entity"]["restore"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.innerworld.entity.restore.useMutation({
    onSuccess: (_data, variables) => {
      void utils.innerworld.entity.get.invalidate({ systemId, entityId: variables.entityId });
      void utils.innerworld.entity.list.invalidate({ systemId });
    },
  });
}

export function useDeleteInnerWorldEntity(): TRPCMutation<
  RouterOutput["innerworld"]["entity"]["delete"],
  RouterInput["innerworld"]["entity"]["delete"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.innerworld.entity.delete.useMutation({
    onSuccess: (_data, variables) => {
      void utils.innerworld.entity.get.invalidate({ systemId, entityId: variables.entityId });
      void utils.innerworld.entity.list.invalidate({ systemId });
    },
  });
}
