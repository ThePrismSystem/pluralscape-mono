import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptRelationship,
  decryptRelationshipPage,
} from "@pluralscape/data/transforms/relationship";
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
  RelationshipDecrypted,
  RelationshipPage as RelationshipRawPage,
  RelationshipRaw,
} from "@pluralscape/data/transforms/relationship";
import type { Archived, MemberId, RelationshipId, RelationshipType } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type RelationshipPage = {
  readonly data: (RelationshipDecrypted | Archived<RelationshipDecrypted>)[];
  readonly nextCursor: string | null;
};

interface RelationshipListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly memberId?: MemberId;
  readonly type?: RelationshipType;
}

export function useRelationship(
  relationshipId: RelationshipId,
  opts?: SystemIdOverride,
): TRPCQuery<RelationshipDecrypted | Archived<RelationshipDecrypted>> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectRelationship = useCallback(
    (raw: RelationshipRaw): RelationshipDecrypted | Archived<RelationshipDecrypted> => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptRelationship(raw, masterKey);
    },
    [masterKey],
  );

  return trpc.relationship.get.useQuery(
    { systemId, relationshipId },
    {
      enabled: masterKey !== null,
      select: selectRelationship,
    },
  );
}

export function useRelationshipsList(
  opts?: RelationshipListOpts,
): TRPCInfiniteQuery<RelationshipPage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectPage = useCallback(
    (data: InfiniteData<RelationshipRawPage>): InfiniteData<RelationshipPage> => {
      if (masterKey === null) throw new Error("masterKey is null");
      const key = masterKey;
      return {
        ...data,
        pages: data.pages.map((page) => decryptRelationshipPage(page, key)),
      };
    },
    [masterKey],
  );

  return trpc.relationship.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      memberId: opts?.memberId,
      type: opts?.type,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: RelationshipRawPage) => lastPage.nextCursor,
      select: selectPage,
    },
  );
}

export function useCreateRelationship(): TRPCMutation<
  RouterOutput["relationship"]["create"],
  RouterInput["relationship"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.relationship.create.useMutation({
    onSuccess: () => {
      void utils.relationship.list.invalidate({ systemId });
    },
  });
}

export function useUpdateRelationship(): TRPCMutation<
  RouterOutput["relationship"]["update"],
  RouterInput["relationship"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.relationship.update.useMutation({
    onSuccess: (_data, variables) => {
      void utils.relationship.get.invalidate({
        systemId,
        relationshipId: variables.relationshipId,
      });
      void utils.relationship.list.invalidate({ systemId });
    },
  });
}

export function useArchiveRelationship(): TRPCMutation<
  RouterOutput["relationship"]["archive"],
  RouterInput["relationship"]["archive"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.relationship.archive.useMutation({
    onSuccess: (_data, variables) => {
      void utils.relationship.get.invalidate({
        systemId,
        relationshipId: variables.relationshipId,
      });
      void utils.relationship.list.invalidate({ systemId });
    },
  });
}

export function useRestoreRelationship(): TRPCMutation<
  RouterOutput["relationship"]["restore"],
  RouterInput["relationship"]["restore"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.relationship.restore.useMutation({
    onSuccess: (_data, variables) => {
      void utils.relationship.get.invalidate({
        systemId,
        relationshipId: variables.relationshipId,
      });
      void utils.relationship.list.invalidate({ systemId });
    },
  });
}

export function useDeleteRelationship(): TRPCMutation<
  RouterOutput["relationship"]["delete"],
  RouterInput["relationship"]["delete"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.relationship.delete.useMutation({
    onSuccess: (_data, variables) => {
      void utils.relationship.get.invalidate({
        systemId,
        relationshipId: variables.relationshipId,
      });
      void utils.relationship.list.invalidate({ systemId });
    },
  });
}
