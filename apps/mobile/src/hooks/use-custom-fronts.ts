import { trpc } from "@pluralscape/api-client/trpc";
import { decryptCustomFront } from "@pluralscape/data/transforms/custom-front";

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
import type { CustomFront, CustomFrontId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type RawCustomFront = RouterOutput["customFront"]["get"];
type RawCustomFrontPage = RouterOutput["customFront"]["list"];
type CustomFrontPage = { readonly items: CustomFront[]; readonly nextCursor: string | null };

interface CustomFrontListOpts extends SystemIdOverride {
  readonly limit?: number;
}

export function useCustomFront(
  customFrontId: CustomFrontId,
  opts?: SystemIdOverride,
): TRPCQuery<CustomFront> {
  const systemId = opts?.systemId ?? useActiveSystemId();
  const masterKey = useMasterKey();

  return trpc.customFront.get.useQuery(
    { systemId, customFrontId },
    {
      enabled: masterKey !== null,
      select: (raw: RawCustomFront): CustomFront => {
        if (masterKey === null) throw new Error("masterKey is null");
        return decryptCustomFront(raw, masterKey);
      },
    },
  );
}

export function useCustomFrontsList(
  opts?: CustomFrontListOpts,
): TRPCInfiniteQuery<CustomFrontPage> {
  const systemId = opts?.systemId ?? useActiveSystemId();
  const masterKey = useMasterKey();

  return trpc.customFront.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: RawCustomFrontPage) => lastPage.nextCursor,
      select: (data: InfiniteData<RawCustomFrontPage>): InfiniteData<CustomFrontPage> => {
        if (masterKey === null) throw new Error("masterKey is null");
        const key = masterKey;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            items: page.data.map((item) => decryptCustomFront(item, key)),
            nextCursor: page.nextCursor,
          })),
        };
      },
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
