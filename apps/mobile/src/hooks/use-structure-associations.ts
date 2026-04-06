import { trpc } from "@pluralscape/api-client/trpc";

import { rowToStructureEntityAssociation } from "../data/row-transforms.js";

import { useOfflineFirstInfiniteQuery, useDomainMutation } from "./factories.js";
import {
  DEFAULT_LIST_LIMIT,
  type DataListQuery,
  type SystemIdOverride,
  type TRPCMutation,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type { SystemStructureEntityAssociation } from "@pluralscape/types";

type AssociationRaw = RouterOutput["structure"]["association"]["list"]["data"][number];
type AssociationPage = RouterOutput["structure"]["association"]["list"];

interface StructureAssociationListOpts extends SystemIdOverride {
  readonly limit?: number;
}

export function useStructureAssociationsList(
  opts?: StructureAssociationListOpts,
): DataListQuery<SystemStructureEntityAssociation> {
  return useOfflineFirstInfiniteQuery<AssociationRaw, SystemStructureEntityAssociation>({
    queryKey: ["structure_entity_associations", "list"],
    table: "structure_entity_associations",
    rowTransform: rowToStructureEntityAssociation,
    systemIdOverride: opts,
    localQueryFn: (localDb, systemId) =>
      localDb
        .queryAll(
          "SELECT * FROM structure_entity_associations WHERE system_id = ? AND archived = 0 ORDER BY created_at DESC",
          [systemId],
        )
        .map(rowToStructureEntityAssociation),
    useRemote: ({ systemId, enabled, select }) =>
      trpc.structure.association.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
        },
        {
          enabled,
          getNextPageParam: (lastPage: AssociationPage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<SystemStructureEntityAssociation>,
  });
}

export function useCreateStructureAssociation(): TRPCMutation<
  RouterOutput["structure"]["association"]["create"],
  RouterInput["structure"]["association"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.structure.association.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.structure.association.list.invalidate({ systemId });
    },
  });
}

export function useDeleteStructureAssociation(): TRPCMutation<
  RouterOutput["structure"]["association"]["delete"],
  RouterInput["structure"]["association"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.structure.association.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.structure.association.list.invalidate({ systemId });
    },
  });
}
