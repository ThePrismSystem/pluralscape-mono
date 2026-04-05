import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptRelationship,
  decryptRelationshipPage,
} from "@pluralscape/data/transforms/relationship";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { rowToRelationship } from "../data/row-transforms.js";
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
): DataQuery<RelationshipDecrypted | Archived<RelationshipDecrypted>> {
  const source = useQuerySource();
  const localDb = useLocalDb();
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

  const localQuery = useQuery({
    queryKey: ["relationships", relationshipId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const row = localDb.queryOne("SELECT * FROM relationships WHERE id = ?", [relationshipId]);
      if (!row) throw new Error("Relationship not found");
      return rowToRelationship(row);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.relationship.get.useQuery(
    { systemId, relationshipId },
    {
      enabled: source === "remote" && masterKey !== null,
      select: selectRelationship,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useRelationshipsList(
  opts?: RelationshipListOpts,
): DataListQuery<RelationshipDecrypted | Archived<RelationshipDecrypted>> {
  const source = useQuerySource();
  const localDb = useLocalDb();
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

  const localQuery = useQuery({
    queryKey: ["relationships", "list", systemId, opts?.memberId, opts?.type],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      let sql = "SELECT * FROM relationships WHERE system_id = ? AND archived = 0";
      const params: unknown[] = [systemId];
      if (opts?.memberId !== undefined) {
        sql += " AND (source_member_id = ? OR target_member_id = ?)";
        params.push(opts.memberId, opts.memberId);
      }
      if (opts?.type !== undefined) {
        sql += " AND type = ?";
        params.push(opts.type);
      }
      return localDb.queryAll(sql, params).map(rowToRelationship);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.relationship.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      memberId: opts?.memberId,
      type: opts?.type,
    },
    {
      enabled: source === "remote" && masterKey !== null,
      getNextPageParam: (lastPage: RelationshipRawPage) => lastPage.nextCursor,
      select: selectPage,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
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
