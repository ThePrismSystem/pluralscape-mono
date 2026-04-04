import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptStructureEntity,
  decryptStructureEntityPage,
} from "@pluralscape/data/transforms/structure-entity";
import { useCallback } from "react";

import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import {
  DEFAULT_LIST_LIMIT,
  type SystemIdOverride,
  type TRPCInfiniteQuery,
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
): TRPCQuery<StructureEntityDecrypted | Archived<StructureEntityDecrypted>> {
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

  return trpc.structure.entity.get.useQuery(
    { systemId, entityId },
    {
      enabled: masterKey !== null,
      select: selectEntity,
    },
  );
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
): TRPCInfiniteQuery<StructureEntityPage> {
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

  return trpc.structure.entity.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
      entityTypeId: opts?.entityTypeId,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: StructureEntityRawPage) => lastPage.nextCursor,
      select: selectPage,
    },
  );
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
