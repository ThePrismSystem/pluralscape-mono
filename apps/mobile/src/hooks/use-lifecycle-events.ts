import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptLifecycleEvent,
  decryptLifecycleEventPage,
} from "@pluralscape/data/transforms/lifecycle-event";
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
import type {
  LifecycleEventPage as LifecycleEventRawPage,
  LifecycleEventRaw,
  LifecycleEventWithArchive,
} from "@pluralscape/data/transforms/lifecycle-event";
import type { LifecycleEventId, LifecycleEventType } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type LifecycleEventPage = {
  readonly data: LifecycleEventWithArchive[];
  readonly nextCursor: string | null;
};

interface LifecycleEventListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly eventType?: LifecycleEventType;
  readonly includeArchived?: boolean;
}

export function useLifecycleEvent(
  eventId: LifecycleEventId,
  opts?: SystemIdOverride,
): TRPCQuery<LifecycleEventWithArchive> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectEvent = useCallback(
    (raw: LifecycleEventRaw): LifecycleEventWithArchive => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptLifecycleEvent(raw, masterKey);
    },
    [masterKey],
  );

  return trpc.lifecycleEvent.get.useQuery(
    { systemId, eventId },
    {
      enabled: masterKey !== null,
      select: selectEvent,
    },
  );
}

export function useLifecycleEventsList(
  opts?: LifecycleEventListOpts,
): TRPCInfiniteQuery<LifecycleEventPage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectPage = useCallback(
    (data: InfiniteData<LifecycleEventRawPage>): InfiniteData<LifecycleEventPage> => {
      if (masterKey === null) throw new Error("masterKey is null");
      return {
        ...data,
        pages: data.pages.map((page) => decryptLifecycleEventPage(page, masterKey)),
      };
    },
    [masterKey],
  );

  return trpc.lifecycleEvent.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      eventType: opts?.eventType,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: LifecycleEventRawPage) => lastPage.nextCursor,
      select: selectPage,
    },
  );
}

export function useCreateLifecycleEvent(): TRPCMutation<
  RouterOutput["lifecycleEvent"]["create"],
  RouterInput["lifecycleEvent"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.lifecycleEvent.create.useMutation({
    onSuccess: () => {
      void utils.lifecycleEvent.list.invalidate({ systemId });
    },
  });
}

export function useUpdateLifecycleEvent(): TRPCMutation<
  RouterOutput["lifecycleEvent"]["update"],
  RouterInput["lifecycleEvent"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.lifecycleEvent.update.useMutation({
    onSuccess: (_data, variables) => {
      void utils.lifecycleEvent.get.invalidate({ systemId, eventId: variables.eventId });
      void utils.lifecycleEvent.list.invalidate({ systemId });
    },
  });
}

export function useArchiveLifecycleEvent(): TRPCMutation<
  RouterOutput["lifecycleEvent"]["archive"],
  RouterInput["lifecycleEvent"]["archive"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.lifecycleEvent.archive.useMutation({
    onSuccess: (_data, variables) => {
      void utils.lifecycleEvent.get.invalidate({ systemId, eventId: variables.eventId });
      void utils.lifecycleEvent.list.invalidate({ systemId });
    },
  });
}

export function useRestoreLifecycleEvent(): TRPCMutation<
  RouterOutput["lifecycleEvent"]["restore"],
  RouterInput["lifecycleEvent"]["restore"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.lifecycleEvent.restore.useMutation({
    onSuccess: (_data, variables) => {
      void utils.lifecycleEvent.get.invalidate({ systemId, eventId: variables.eventId });
      void utils.lifecycleEvent.list.invalidate({ systemId });
    },
  });
}

export function useDeleteLifecycleEvent(): TRPCMutation<
  RouterOutput["lifecycleEvent"]["delete"],
  RouterInput["lifecycleEvent"]["delete"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.lifecycleEvent.delete.useMutation({
    onSuccess: (_data, variables) => {
      void utils.lifecycleEvent.get.invalidate({ systemId, eventId: variables.eventId });
      void utils.lifecycleEvent.list.invalidate({ systemId });
    },
  });
}
