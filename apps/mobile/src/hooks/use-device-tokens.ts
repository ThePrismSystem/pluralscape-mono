import { trpc } from "@pluralscape/api-client/trpc";

import { useActiveSystemId } from "../providers/system-provider.js";

import { useDomainMutation } from "./factories.js";
import {
  DEFAULT_LIST_LIMIT,
  type SystemIdOverride,
  type TRPCInfiniteQuery,
  type TRPCMutation,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";

type DeviceTokenPage = RouterOutput["deviceToken"]["list"];

interface DeviceTokenListOpts extends SystemIdOverride {
  readonly limit?: number;
}

export function useDeviceTokensList(
  opts?: DeviceTokenListOpts,
): TRPCInfiniteQuery<DeviceTokenPage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  return trpc.deviceToken.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
    },
    {
      getNextPageParam: (lastPage: DeviceTokenPage) => lastPage.nextCursor,
    },
  );
}

export function useRegisterDeviceToken(): TRPCMutation<
  RouterOutput["deviceToken"]["register"],
  RouterInput["deviceToken"]["register"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.deviceToken.register.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.deviceToken.list.invalidate({ systemId });
    },
  });
}

export function useUpdateDeviceToken(): TRPCMutation<
  RouterOutput["deviceToken"]["update"],
  RouterInput["deviceToken"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.deviceToken.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.deviceToken.list.invalidate({ systemId });
    },
  });
}

export function useRevokeDeviceToken(): TRPCMutation<
  RouterOutput["deviceToken"]["revoke"],
  RouterInput["deviceToken"]["revoke"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.deviceToken.revoke.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.deviceToken.list.invalidate({ systemId });
    },
  });
}

export function useDeleteDeviceToken(): TRPCMutation<
  RouterOutput["deviceToken"]["delete"],
  RouterInput["deviceToken"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.deviceToken.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.deviceToken.list.invalidate({ systemId });
    },
  });
}
