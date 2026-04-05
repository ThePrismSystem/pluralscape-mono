import { trpc } from "@pluralscape/api-client/trpc";
import { decryptCustomFront } from "@pluralscape/data/transforms/custom-front";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { rowToCustomFront } from "../data/row-transforms.js";
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

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  CustomFrontPage as CustomFrontRawPage,
  CustomFrontRaw,
} from "@pluralscape/data/transforms/custom-front";
import type { Archived, CustomFront, CustomFrontId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type CustomFrontPage = {
  readonly data: (CustomFront | Archived<CustomFront>)[];
  readonly nextCursor: string | null;
};

interface CustomFrontListOpts extends SystemIdOverride {
  readonly limit?: number;
}

export function useCustomFront(
  customFrontId: CustomFrontId,
  opts?: SystemIdOverride,
): DataQuery<CustomFront | Archived<CustomFront>> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectCustomFront = useCallback(
    (raw: CustomFrontRaw): CustomFront | Archived<CustomFront> => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptCustomFront(raw, masterKey);
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["custom_fronts", customFrontId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const row = localDb.queryOne("SELECT * FROM custom_fronts WHERE id = ?", [customFrontId]);
      if (!row) throw new Error("Custom front not found");
      return rowToCustomFront(row);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.customFront.get.useQuery(
    { systemId, customFrontId },
    {
      enabled: source === "remote" && masterKey !== null,
      select: selectCustomFront,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useCustomFrontsList(
  opts?: CustomFrontListOpts,
): DataListQuery<CustomFront | Archived<CustomFront>> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectCustomFrontsList = useCallback(
    (data: InfiniteData<CustomFrontRawPage>): InfiniteData<CustomFrontPage> => {
      if (masterKey === null) throw new Error("masterKey is null");
      const key = masterKey;
      return {
        ...data,
        pages: data.pages.map((page) => ({
          data: page.data.map((item) => decryptCustomFront(item, key)),
          nextCursor: page.nextCursor,
        })),
      };
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["custom_fronts", "list", systemId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      return localDb
        .queryAll("SELECT * FROM custom_fronts WHERE system_id = ? AND archived = 0", [systemId])
        .map(rowToCustomFront);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.customFront.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
    },
    {
      enabled: source === "remote" && masterKey !== null,
      getNextPageParam: (lastPage: CustomFrontRawPage) => lastPage.nextCursor,
      select: selectCustomFrontsList,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useCreateCustomFront(): TRPCMutation<
  RouterOutput["customFront"]["create"],
  RouterInput["customFront"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.customFront.create.useMutation({
    onSuccess: () => {
      void utils.customFront.list.invalidate({ systemId });
    },
  });
}

export function useUpdateCustomFront(): TRPCMutation<
  RouterOutput["customFront"]["update"],
  RouterInput["customFront"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.customFront.update.useMutation({
    onSuccess: (_data, variables) => {
      void utils.customFront.get.invalidate({ systemId, customFrontId: variables.customFrontId });
      void utils.customFront.list.invalidate({ systemId });
    },
  });
}

export function useDeleteCustomFront(): TRPCMutation<
  RouterOutput["customFront"]["delete"],
  RouterInput["customFront"]["delete"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.customFront.delete.useMutation({
    onSuccess: (_data, variables) => {
      void utils.customFront.get.invalidate({ systemId, customFrontId: variables.customFrontId });
      void utils.customFront.list.invalidate({ systemId });
    },
  });
}
