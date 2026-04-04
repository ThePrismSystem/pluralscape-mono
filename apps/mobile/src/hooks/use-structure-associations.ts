import { trpc } from "@pluralscape/api-client/trpc";

import { useActiveSystemId } from "../providers/system-provider.js";

import {
  DEFAULT_LIST_LIMIT,
  type SystemIdOverride,
  type TRPCInfiniteQuery,
  type TRPCMutation,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";

type AssociationPage = RouterOutput["structure"]["association"]["list"];

interface StructureAssociationListOpts extends SystemIdOverride {
  readonly limit?: number;
}

export function useStructureAssociationsList(
  opts?: StructureAssociationListOpts,
): TRPCInfiniteQuery<AssociationPage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  return trpc.structure.association.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
    },
    {
      getNextPageParam: (lastPage: AssociationPage) => lastPage.nextCursor,
    },
  );
}

export function useCreateStructureAssociation(): TRPCMutation<
  RouterOutput["structure"]["association"]["create"],
  RouterInput["structure"]["association"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.structure.association.create.useMutation({
    onSuccess: () => {
      void utils.structure.association.list.invalidate({ systemId });
    },
  });
}

export function useDeleteStructureAssociation(): TRPCMutation<
  RouterOutput["structure"]["association"]["delete"],
  RouterInput["structure"]["association"]["delete"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.structure.association.delete.useMutation({
    onSuccess: () => {
      void utils.structure.association.list.invalidate({ systemId });
    },
  });
}
