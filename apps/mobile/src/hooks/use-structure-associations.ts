import { trpc } from "@pluralscape/api-client/trpc";
import { useQuery } from "@tanstack/react-query";

import { rowToStructureEntityAssociation } from "../data/row-transforms.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import {
  DEFAULT_LIST_LIMIT,
  type DataListQuery,
  type SystemIdOverride,
  type TRPCMutation,
} from "./types.js";
import { useLocalDb, useQuerySource } from "./use-query-source.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type { SystemStructureEntityAssociation } from "@pluralscape/types";

type AssociationPage = RouterOutput["structure"]["association"]["list"];
type AssociationItem = AssociationPage["data"][number];

interface StructureAssociationListOpts extends SystemIdOverride {
  readonly limit?: number;
}

export function useStructureAssociationsList(
  opts?: StructureAssociationListOpts,
): DataListQuery<SystemStructureEntityAssociation | AssociationItem> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  const localQuery = useQuery({
    queryKey: ["structure_entity_associations", "list", systemId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      return localDb
        .queryAll(
          "SELECT * FROM structure_entity_associations WHERE system_id = ? AND archived = 0",
          [systemId],
        )
        .map(rowToStructureEntityAssociation);
    },
    enabled: source === "local",
  });

  const remoteQuery = trpc.structure.association.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
    },
    {
      enabled: source === "remote",
      getNextPageParam: (lastPage: AssociationPage) => lastPage.nextCursor,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
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
