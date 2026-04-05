import { trpc } from "@pluralscape/api-client/trpc";
import { useQuery } from "@tanstack/react-query";

import { rowToStructureEntityMemberLink } from "../data/row-transforms.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import {
  DEFAULT_LIST_LIMIT,
  type DataListQuery,
  type SystemIdOverride,
  type TRPCMutation,
} from "./types.js";
import { useLocalDb, useQuerySource } from "./use-query-source.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type { SystemStructureEntityMemberLink } from "@pluralscape/types";

type MemberLinkPage = RouterOutput["structure"]["memberLink"]["list"];
type MemberLinkItem = MemberLinkPage["data"][number];

interface StructureMemberLinkListOpts extends SystemIdOverride {
  readonly limit?: number;
}

export function useStructureMemberLinksList(
  opts?: StructureMemberLinkListOpts,
): DataListQuery<SystemStructureEntityMemberLink | MemberLinkItem> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  const localQuery = useQuery({
    queryKey: ["structure_entity_member_links", "list", systemId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      return localDb
        .queryAll(
          "SELECT * FROM structure_entity_member_links WHERE system_id = ? AND archived = 0",
          [systemId],
        )
        .map(rowToStructureEntityMemberLink);
    },
    enabled: source === "local",
  });

  const remoteQuery = trpc.structure.memberLink.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
    },
    {
      enabled: source === "remote",
      getNextPageParam: (lastPage: MemberLinkPage) => lastPage.nextCursor,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useCreateStructureMemberLink(): TRPCMutation<
  RouterOutput["structure"]["memberLink"]["create"],
  RouterInput["structure"]["memberLink"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.structure.memberLink.create.useMutation({
    onSuccess: () => {
      void utils.structure.memberLink.list.invalidate({ systemId });
    },
  });
}

export function useDeleteStructureMemberLink(): TRPCMutation<
  RouterOutput["structure"]["memberLink"]["delete"],
  RouterInput["structure"]["memberLink"]["delete"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.structure.memberLink.delete.useMutation({
    onSuccess: () => {
      void utils.structure.memberLink.list.invalidate({ systemId });
    },
  });
}
