import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptStructureEntityType,
  decryptStructureEntityTypePage,
} from "@pluralscape/data/transforms/structure-entity-type";
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
): TRPCQuery<StructureEntityTypeDecrypted | Archived<StructureEntityTypeDecrypted>> {
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

  return trpc.structure.entityType.get.useQuery(
    { systemId, entityTypeId },
    {
      enabled: masterKey !== null,
      select: selectEntityType,
    },
  );
}

export function useStructureEntityTypesList(
  opts?: StructureEntityTypeListOpts,
): TRPCInfiniteQuery<StructureEntityTypePage> {
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

  return trpc.structure.entityType.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: StructureEntityTypeRawPage) => lastPage.nextCursor,
      select: selectPage,
    },
  );
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
