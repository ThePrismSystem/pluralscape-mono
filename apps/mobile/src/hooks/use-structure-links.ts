import { trpc } from "@pluralscape/api-client/trpc";
import { useQuery } from "@tanstack/react-query";

import { rowToStructureEntityLink } from "../data/row-transforms.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import {
  DEFAULT_LIST_LIMIT,
  type DataListQuery,
  type SystemIdOverride,
  type TRPCMutation,
} from "./types.js";
import { useLocalDb, useQuerySource } from "./use-query-source.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type { SystemStructureEntityLink } from "@pluralscape/types";

type LinkPage = RouterOutput["structure"]["link"]["list"];
type LinkItem = LinkPage["data"][number];

interface StructureLinkListOpts extends SystemIdOverride {
  readonly limit?: number;
}

export function useStructureLinksList(
  opts?: StructureLinkListOpts,
): DataListQuery<SystemStructureEntityLink | LinkItem> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  const localQuery = useQuery({
    queryKey: ["structure_entity_links", "list", systemId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      return localDb
        .queryAll(
          "SELECT * FROM structure_entity_links WHERE system_id = ? AND archived = 0 ORDER BY sort_order ASC",
          [systemId],
        )
        .map(rowToStructureEntityLink);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.structure.link.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
    },
    {
      enabled: source === "remote",
      getNextPageParam: (lastPage: LinkPage) => lastPage.nextCursor,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
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
