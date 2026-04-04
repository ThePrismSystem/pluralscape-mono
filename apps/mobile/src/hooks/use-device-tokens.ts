import { trpc } from "@pluralscape/api-client/trpc";

import { useActiveSystemId } from "../providers/system-provider.js";

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
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.deviceToken.register.useMutation({
    onSuccess: () => {
      void utils.deviceToken.list.invalidate({ systemId });
    },
  });
}

export function useUpdateDeviceToken(): TRPCMutation<
  RouterOutput["deviceToken"]["update"],
  RouterInput["deviceToken"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.deviceToken.update.useMutation({
    onSuccess: () => {
      void utils.deviceToken.list.invalidate({ systemId });
    },
  });
}

export function useRevokeDeviceToken(): TRPCMutation<
  RouterOutput["deviceToken"]["revoke"],
  RouterInput["deviceToken"]["revoke"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.deviceToken.revoke.useMutation({
    onSuccess: () => {
      void utils.deviceToken.list.invalidate({ systemId });
    },
  });
}

export function useDeleteDeviceToken(): TRPCMutation<
  RouterOutput["deviceToken"]["delete"],
  RouterInput["deviceToken"]["delete"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.deviceToken.delete.useMutation({
    onSuccess: () => {
      void utils.deviceToken.list.invalidate({ systemId });
    },
  });
}
