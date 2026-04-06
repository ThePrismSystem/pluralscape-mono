import { trpc } from "@pluralscape/api-client/trpc";
import { decryptRelationship } from "@pluralscape/data/transforms/relationship";

import { rowToRelationship } from "../data/row-transforms.js";

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
  RelationshipDecrypted,
  RelationshipPage as RelationshipRawPage,
  RelationshipRaw,
} from "@pluralscape/data/transforms/relationship";
import type { Archived, MemberId, RelationshipId, RelationshipType } from "@pluralscape/types";

interface RelationshipListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly memberId?: MemberId;
  readonly type?: RelationshipType;
}

export function useRelationship(
  relationshipId: RelationshipId,
  opts?: SystemIdOverride,
): DataQuery<RelationshipDecrypted | Archived<RelationshipDecrypted>> {
  return useOfflineFirstQuery<
    RelationshipRaw,
    RelationshipDecrypted | Archived<RelationshipDecrypted>
  >({
    queryKey: ["relationships", relationshipId],
    table: "relationships",
    entityId: relationshipId,
    rowTransform: rowToRelationship,
    decrypt: decryptRelationship,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.relationship.get.useQuery(
        { systemId, relationshipId },
        { enabled, select },
      ) as DataQuery<RelationshipDecrypted | Archived<RelationshipDecrypted>>,
  });
}

export function useRelationshipsList(
  opts?: RelationshipListOpts,
): DataListQuery<RelationshipDecrypted | Archived<RelationshipDecrypted>> {
  return useOfflineFirstInfiniteQuery<
    RelationshipRaw,
    RelationshipDecrypted | Archived<RelationshipDecrypted>
  >({
    queryKey: ["relationships", "list", opts?.memberId, opts?.type],
    table: "relationships",
    rowTransform: rowToRelationship,
    decrypt: decryptRelationship,
    systemIdOverride: opts,
    // Custom local SQL: filter by source OR target member, plus optional type
    localQueryFn: (localDb, systemId) => {
      let sql =
        "SELECT * FROM relationships WHERE system_id = ? AND archived = 0 ORDER BY created_at DESC";
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
    useRemote: ({ systemId, enabled, select }) =>
      trpc.relationship.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
          memberId: opts?.memberId,
          type: opts?.type,
        },
        {
          enabled,
          getNextPageParam: (lastPage: RelationshipRawPage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<RelationshipDecrypted | Archived<RelationshipDecrypted>>,
  });
}

export function useCreateRelationship(): TRPCMutation<
  RouterOutput["relationship"]["create"],
  RouterInput["relationship"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.relationship.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.relationship.list.invalidate({ systemId });
    },
  });
}

export function useUpdateRelationship(): TRPCMutation<
  RouterOutput["relationship"]["update"],
  RouterInput["relationship"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.relationship.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
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
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.relationship.archive.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
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
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.relationship.restore.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
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
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.relationship.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.relationship.get.invalidate({
        systemId,
        relationshipId: variables.relationshipId,
      });
      void utils.relationship.list.invalidate({ systemId });
    },
  });
}
