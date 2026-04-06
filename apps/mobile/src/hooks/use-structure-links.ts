import { trpc } from "@pluralscape/api-client/trpc";

import { rowToStructureEntityLink } from "../data/row-transforms.js";

import { useOfflineFirstInfiniteQuery, useDomainMutation } from "./factories.js";
import {
  DEFAULT_LIST_LIMIT,
  type DataListQuery,
  type SystemIdOverride,
  type TRPCMutation,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type { SystemStructureEntityLink } from "@pluralscape/types";

type LinkRaw = RouterOutput["structure"]["link"]["list"]["data"][number];
type LinkPage = RouterOutput["structure"]["link"]["list"];

interface StructureLinkListOpts extends SystemIdOverride {
  readonly limit?: number;
}

export function useStructureLinksList(
  opts?: StructureLinkListOpts,
): DataListQuery<SystemStructureEntityLink> {
  return useOfflineFirstInfiniteQuery<LinkRaw, SystemStructureEntityLink>({
    queryKey: ["structure_entity_links", "list", opts?.systemId],
    table: "structure_entity_links",
    rowTransform: rowToStructureEntityLink,
    systemIdOverride: opts,
    localQueryFn: (localDb, systemId) =>
      localDb
        .queryAll(
          "SELECT * FROM structure_entity_links WHERE system_id = ? AND archived = 0 ORDER BY sort_order ASC",
          [systemId],
        )
        .map(rowToStructureEntityLink),
    useRemote: ({ systemId, enabled, select }) =>
      trpc.structure.link.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
        },
        {
          enabled,
          getNextPageParam: (lastPage: LinkPage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<SystemStructureEntityLink>,
  });
}

export function useCreateStructureLink(): TRPCMutation<
  RouterOutput["structure"]["link"]["create"],
  RouterInput["structure"]["link"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.structure.link.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.structure.link.list.invalidate({ systemId });
    },
  });
}

export function useUpdateStructureLink(): TRPCMutation<
  RouterOutput["structure"]["link"]["update"],
  RouterInput["structure"]["link"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.structure.link.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.structure.link.list.invalidate({ systemId });
    },
  });
}

export function useDeleteStructureLink(): TRPCMutation<
  RouterOutput["structure"]["link"]["delete"],
  RouterInput["structure"]["link"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.structure.link.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.structure.link.list.invalidate({ systemId });
    },
  });
}
