import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptInnerWorldRegion,
  decryptInnerWorldRegionPage,
} from "@pluralscape/data/transforms/innerworld-region";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { rowToInnerWorldRegionRow } from "../data/row-transforms.js";
import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import {
  DEFAULT_LIST_LIMIT,
  type DataListQuery,
  type DataQuery,
  type SystemIdOverride,
  type TRPCMutation,
} from "./types.js";
import { useLocalDb, useQuerySource } from "./use-query-source.js";

import type { InnerWorldRegionLocalRow } from "../data/row-transforms.js";
import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  InnerWorldRegionDecrypted,
  InnerWorldRegionPage as InnerWorldRegionRawPage,
  InnerWorldRegionRaw,
} from "@pluralscape/data/transforms/innerworld-region";
import type { Archived, InnerWorldRegionId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type InnerWorldRegionPage = {
  readonly data: (InnerWorldRegionDecrypted | Archived<InnerWorldRegionDecrypted>)[];
  readonly nextCursor: string | null;
};

interface InnerWorldRegionListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function useInnerWorldRegion(
  regionId: InnerWorldRegionId,
  opts?: SystemIdOverride,
): DataQuery<
  InnerWorldRegionDecrypted | Archived<InnerWorldRegionDecrypted> | InnerWorldRegionLocalRow
> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectRegion = useCallback(
    (raw: InnerWorldRegionRaw): InnerWorldRegionDecrypted | Archived<InnerWorldRegionDecrypted> => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptInnerWorldRegion(raw, masterKey);
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["innerworld-regions", regionId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const row = localDb.queryOne("SELECT * FROM innerworld_regions WHERE id = ?", [regionId]);
      if (!row) throw new Error("InnerWorldRegion not found");
      return rowToInnerWorldRegionRow(row);
    },
    enabled: source === "local",
  });

  const remoteQuery = trpc.innerworld.region.get.useQuery(
    { systemId, regionId },
    {
      enabled: source === "remote" && masterKey !== null,
      select: selectRegion,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useInnerWorldRegionsList(
  opts?: InnerWorldRegionListOpts,
): DataListQuery<
  InnerWorldRegionDecrypted | Archived<InnerWorldRegionDecrypted> | InnerWorldRegionLocalRow
> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectPage = useCallback(
    (data: InfiniteData<InnerWorldRegionRawPage>): InfiniteData<InnerWorldRegionPage> => {
      if (masterKey === null) throw new Error("masterKey is null");
      const key = masterKey;
      return {
        ...data,
        pages: data.pages.map((page) => decryptInnerWorldRegionPage(page, key)),
      };
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["innerworld-regions", "list", systemId, opts?.includeArchived ?? false],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const includeArchived = opts?.includeArchived ?? false;
      const sql = includeArchived
        ? "SELECT * FROM innerworld_regions WHERE system_id = ?"
        : "SELECT * FROM innerworld_regions WHERE system_id = ? AND archived = 0";
      return localDb.queryAll(sql, [systemId]).map(rowToInnerWorldRegionRow);
    },
    enabled: source === "local",
  });

  const remoteQuery = trpc.innerworld.region.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: source === "remote" && masterKey !== null,
      getNextPageParam: (lastPage: InnerWorldRegionRawPage) => lastPage.nextCursor,
      select: selectPage,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useCreateInnerWorldRegion(): TRPCMutation<
  RouterOutput["innerworld"]["region"]["create"],
  RouterInput["innerworld"]["region"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.innerworld.region.create.useMutation({
    onSuccess: () => {
      void utils.innerworld.region.list.invalidate({ systemId });
    },
  });
}

export function useUpdateInnerWorldRegion(): TRPCMutation<
  RouterOutput["innerworld"]["region"]["update"],
  RouterInput["innerworld"]["region"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.innerworld.region.update.useMutation({
    onSuccess: (_data, variables) => {
      void utils.innerworld.region.get.invalidate({ systemId, regionId: variables.regionId });
      void utils.innerworld.region.list.invalidate({ systemId });
    },
  });
}

export function useArchiveInnerWorldRegion(): TRPCMutation<
  RouterOutput["innerworld"]["region"]["archive"],
  RouterInput["innerworld"]["region"]["archive"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.innerworld.region.archive.useMutation({
    onSuccess: (_data, variables) => {
      void utils.innerworld.region.get.invalidate({ systemId, regionId: variables.regionId });
      void utils.innerworld.region.list.invalidate({ systemId });
    },
  });
}

export function useRestoreInnerWorldRegion(): TRPCMutation<
  RouterOutput["innerworld"]["region"]["restore"],
  RouterInput["innerworld"]["region"]["restore"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.innerworld.region.restore.useMutation({
    onSuccess: (_data, variables) => {
      void utils.innerworld.region.get.invalidate({ systemId, regionId: variables.regionId });
      void utils.innerworld.region.list.invalidate({ systemId });
    },
  });
}

export function useDeleteInnerWorldRegion(): TRPCMutation<
  RouterOutput["innerworld"]["region"]["delete"],
  RouterInput["innerworld"]["region"]["delete"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.innerworld.region.delete.useMutation({
    onSuccess: (_data, variables) => {
      void utils.innerworld.region.get.invalidate({ systemId, regionId: variables.regionId });
      void utils.innerworld.region.list.invalidate({ systemId });
    },
  });
}
