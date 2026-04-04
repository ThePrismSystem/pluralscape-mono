import { trpc } from "@pluralscape/api-client/trpc";

import { useActiveSystemId } from "../providers/system-provider.js";

import { type TRPCMutation, type TRPCQuery } from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";

type NotificationConfig = RouterOutput["notificationConfig"]["get"];
type NotificationConfigList = RouterOutput["notificationConfig"]["list"];

export function useNotificationConfig(
  eventType: RouterInput["notificationConfig"]["get"]["eventType"],
): TRPCQuery<NotificationConfig> {
  const systemId = useActiveSystemId();

  return trpc.notificationConfig.get.useQuery({ systemId, eventType });
}

export function useNotificationConfigList(): TRPCQuery<NotificationConfigList> {
  const systemId = useActiveSystemId();

  return trpc.notificationConfig.list.useQuery({ systemId });
}

export function useUpdateNotificationConfig(): TRPCMutation<
  RouterOutput["notificationConfig"]["update"],
  RouterInput["notificationConfig"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.notificationConfig.update.useMutation({
    onSuccess: (_data, variables) => {
      void utils.notificationConfig.get.invalidate({ systemId, eventType: variables.eventType });
      void utils.notificationConfig.list.invalidate({ systemId });
    },
  });
}
