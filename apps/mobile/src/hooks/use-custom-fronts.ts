import { trpc } from "@pluralscape/api-client/trpc";
import { decryptCustomFront } from "@pluralscape/data/transforms/custom-front";
import { useCallback } from "react";

import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import {
  DEFAULT_LIST_LIMIT,
  type SystemIdOverride,
  type TRPCInfiniteQuery,
  type TRPCMutation,
  type TRPCQuery,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type { Archived, CustomFront, CustomFrontId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type RawCustomFront = RouterOutput["customFront"]["get"];
type RawCustomFrontPage = RouterOutput["customFront"]["list"];
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
): TRPCQuery<CustomFront | Archived<CustomFront>> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectCustomFront = useCallback(
    (raw: RawCustomFront): CustomFront | Archived<CustomFront> => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptCustomFront(raw, masterKey);
    },
    [masterKey],
  );

  return trpc.customFront.get.useQuery(
    { systemId, customFrontId },
    {
      enabled: masterKey !== null,
      select: selectCustomFront,
    },
  );
}

export function useCustomFrontsList(
  opts?: CustomFrontListOpts,
): TRPCInfiniteQuery<CustomFrontPage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectCustomFrontsList = useCallback(
    (data: InfiniteData<RawCustomFrontPage>): InfiniteData<CustomFrontPage> => {
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

  return trpc.customFront.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: RawCustomFrontPage) => lastPage.nextCursor,
      select: selectCustomFrontsList,
    },
  );
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
