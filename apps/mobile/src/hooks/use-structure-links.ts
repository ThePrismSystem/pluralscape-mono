import { trpc } from "@pluralscape/api-client/trpc";

import { useActiveSystemId } from "../providers/system-provider.js";

import {
  DEFAULT_LIST_LIMIT,
  type SystemIdOverride,
  type TRPCInfiniteQuery,
  type TRPCMutation,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";

type LinkPage = RouterOutput["structure"]["link"]["list"];

interface StructureLinkListOpts extends SystemIdOverride {
  readonly limit?: number;
}

export function useStructureLinksList(opts?: StructureLinkListOpts): TRPCInfiniteQuery<LinkPage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  return trpc.structure.link.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
    },
    {
      getNextPageParam: (lastPage: LinkPage) => lastPage.nextCursor,
    },
  );
}

export function useCreateStructureLink(): TRPCMutation<
  RouterOutput["structure"]["link"]["create"],
  RouterInput["structure"]["link"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.structure.link.create.useMutation({
    onSuccess: () => {
      void utils.structure.link.list.invalidate({ systemId });
    },
  });
}

export function useUpdateStructureLink(): TRPCMutation<
  RouterOutput["structure"]["link"]["update"],
  RouterInput["structure"]["link"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.structure.link.update.useMutation({
    onSuccess: () => {
      void utils.structure.link.list.invalidate({ systemId });
    },
  });
}

export function useDeleteStructureLink(): TRPCMutation<
  RouterOutput["structure"]["link"]["delete"],
  RouterInput["structure"]["link"]["delete"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.structure.link.delete.useMutation({
    onSuccess: () => {
      void utils.structure.link.list.invalidate({ systemId });
    },
  });
}
