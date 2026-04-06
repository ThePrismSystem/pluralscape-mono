import { trpc } from "@pluralscape/api-client/trpc";

import { useActiveSystemId } from "../providers/system-provider.js";

import { useDomainMutation } from "./factories.js";
import {
  DEFAULT_LIST_LIMIT,
  type SystemIdOverride,
  type TRPCInfiniteQuery,
  type TRPCMutation,
  type TRPCQuery,
} from "./types.js";


import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type { ApiKeyId } from "@pluralscape/types";

type ApiKeyPage = RouterOutput["apiKey"]["list"];
type ApiKeyDetail = RouterOutput["apiKey"]["get"];

interface ApiKeyListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeRevoked?: boolean;
}

export function useApiKey(apiKeyId: ApiKeyId, opts?: SystemIdOverride): TRPCQuery<ApiKeyDetail> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  return trpc.apiKey.get.useQuery({ systemId, apiKeyId });
}

export function useApiKeysList(opts?: ApiKeyListOpts): TRPCInfiniteQuery<ApiKeyPage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  return trpc.apiKey.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeRevoked: opts?.includeRevoked ?? false,
    },
    {
      getNextPageParam: (lastPage: ApiKeyPage) => lastPage.nextCursor,
    },
  );
}

export function useCreateApiKey(): TRPCMutation<
  RouterOutput["apiKey"]["create"],
  RouterInput["apiKey"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.apiKey.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.apiKey.list.invalidate({ systemId });
    },
  });
}

export function useRevokeApiKey(): TRPCMutation<
  RouterOutput["apiKey"]["revoke"],
  RouterInput["apiKey"]["revoke"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.apiKey.revoke.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.apiKey.get.invalidate({ systemId, apiKeyId: variables.apiKeyId });
      void utils.apiKey.list.invalidate({ systemId });
    },
  });
}
