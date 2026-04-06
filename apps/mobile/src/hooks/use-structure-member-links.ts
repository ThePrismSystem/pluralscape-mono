import { trpc } from "@pluralscape/api-client/trpc";

import { rowToStructureEntityMemberLink } from "../data/row-transforms/index.js";

import { useOfflineFirstInfiniteQuery, useDomainMutation } from "./factories.js";
import {
  DEFAULT_LIST_LIMIT,
  type DataListQuery,
  type SystemIdOverride,
  type TRPCMutation,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type { SystemStructureEntityMemberLink } from "@pluralscape/types";

type MemberLinkRaw = RouterOutput["structure"]["memberLink"]["list"]["data"][number];
type MemberLinkPage = RouterOutput["structure"]["memberLink"]["list"];

interface StructureMemberLinkListOpts extends SystemIdOverride {
  readonly limit?: number;
}

export function useStructureMemberLinksList(
  opts?: StructureMemberLinkListOpts,
): DataListQuery<SystemStructureEntityMemberLink> {
  return useOfflineFirstInfiniteQuery<MemberLinkRaw, SystemStructureEntityMemberLink>({
    queryKey: ["structure_entity_member_links", "list"],
    table: "structure_entity_member_links",
    rowTransform: rowToStructureEntityMemberLink,
    systemIdOverride: opts,
    localQueryFn: (localDb, systemId) =>
      localDb
        .queryAll(
          "SELECT * FROM structure_entity_member_links WHERE system_id = ? AND archived = 0 ORDER BY sort_order ASC",
          [systemId],
        )
        .map(rowToStructureEntityMemberLink),
    useRemote: ({ systemId, enabled, select }) =>
      trpc.structure.memberLink.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
        },
        {
          enabled,
          getNextPageParam: (lastPage: MemberLinkPage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<SystemStructureEntityMemberLink>,
  });
}

export function useCreateStructureMemberLink(): TRPCMutation<
  RouterOutput["structure"]["memberLink"]["create"],
  RouterInput["structure"]["memberLink"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.structure.memberLink.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.structure.memberLink.list.invalidate({ systemId });
    },
  });
}

export function useDeleteStructureMemberLink(): TRPCMutation<
  RouterOutput["structure"]["memberLink"]["delete"],
  RouterInput["structure"]["memberLink"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.structure.memberLink.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.structure.memberLink.list.invalidate({ systemId });
    },
  });
}
