import { trpc } from "@pluralscape/api-client/trpc";

import { useActiveSystemId } from "../providers/system-provider.js";

import {
  DEFAULT_LIST_LIMIT,
  type SystemIdOverride,
  type TRPCInfiniteQuery,
  type TRPCMutation,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";

type MemberLinkPage = RouterOutput["structure"]["memberLink"]["list"];

interface StructureMemberLinkListOpts extends SystemIdOverride {
  readonly limit?: number;
}

export function useStructureMemberLinksList(
  opts?: StructureMemberLinkListOpts,
): TRPCInfiniteQuery<MemberLinkPage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  return trpc.structure.memberLink.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
    },
    {
      getNextPageParam: (lastPage: MemberLinkPage) => lastPage.nextCursor,
    },
  );
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
