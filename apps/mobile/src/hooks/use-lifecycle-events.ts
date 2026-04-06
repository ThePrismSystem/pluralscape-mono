import { trpc } from "@pluralscape/api-client/trpc";
import { decryptLifecycleEvent } from "@pluralscape/data/transforms/lifecycle-event";

import { rowToLifecycleEvent } from "../data/row-transforms/index.js";

import {
  useOfflineFirstQuery,
  useOfflineFirstInfiniteQuery,
  useDomainMutation,
} from "./factories.js";
import {
  DEFAULT_LIST_LIMIT,
  type DataListQuery,
  type DataQuery,
  type SystemIdOverride,
  type TRPCMutation,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  LifecycleEventPage as LifecycleEventRawPage,
  LifecycleEventRaw,
  LifecycleEventWithArchive,
} from "@pluralscape/data/transforms/lifecycle-event";
import type { LifecycleEventId, LifecycleEventType } from "@pluralscape/types";

interface LifecycleEventListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly eventType?: LifecycleEventType;
  readonly includeArchived?: boolean;
}

export function useLifecycleEvent(
  eventId: LifecycleEventId,
  opts?: SystemIdOverride,
): DataQuery<LifecycleEventWithArchive> {
  return useOfflineFirstQuery<LifecycleEventRaw, LifecycleEventWithArchive>({
    queryKey: ["lifecycle_events", eventId],
    table: "lifecycle_events",
    entityId: eventId,
    rowTransform: rowToLifecycleEvent,
    decrypt: decryptLifecycleEvent,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.lifecycleEvent.get.useQuery(
        { systemId, eventId },
        { enabled, select },
      ) as DataQuery<LifecycleEventWithArchive>,
  });
}

export function useLifecycleEventsList(
  opts?: LifecycleEventListOpts,
): DataListQuery<LifecycleEventWithArchive> {
  return useOfflineFirstInfiniteQuery<LifecycleEventRaw, LifecycleEventWithArchive>({
    queryKey: ["lifecycle_events", "list", opts?.includeArchived ?? false],
    table: "lifecycle_events",
    rowTransform: rowToLifecycleEvent,
    decrypt: decryptLifecycleEvent,
    includeArchived: opts?.includeArchived,
    systemIdOverride: opts,
    // Custom orderBy: lifecycle events sort by occurred_at, not created_at
    localQueryFn: (localDb, systemId) => {
      const includeArchived = opts?.includeArchived ?? false;
      const sql = includeArchived
        ? "SELECT * FROM lifecycle_events WHERE system_id = ? ORDER BY occurred_at DESC"
        : "SELECT * FROM lifecycle_events WHERE system_id = ? AND archived = 0 ORDER BY occurred_at DESC";
      return localDb.queryAll(sql, [systemId]).map(rowToLifecycleEvent);
    },
    useRemote: ({ systemId, enabled, select }) =>
      trpc.lifecycleEvent.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
          eventType: opts?.eventType,
          includeArchived: opts?.includeArchived ?? false,
        },
        {
          enabled,
          getNextPageParam: (lastPage: LifecycleEventRawPage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<LifecycleEventWithArchive>,
  });
}

export function useCreateLifecycleEvent(): TRPCMutation<
  RouterOutput["lifecycleEvent"]["create"],
  RouterInput["lifecycleEvent"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.lifecycleEvent.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.lifecycleEvent.list.invalidate({ systemId });
    },
  });
}

export function useUpdateLifecycleEvent(): TRPCMutation<
  RouterOutput["lifecycleEvent"]["update"],
  RouterInput["lifecycleEvent"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.lifecycleEvent.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.lifecycleEvent.get.invalidate({ systemId, eventId: variables.eventId });
      void utils.lifecycleEvent.list.invalidate({ systemId });
    },
  });
}

export function useArchiveLifecycleEvent(): TRPCMutation<
  RouterOutput["lifecycleEvent"]["archive"],
  RouterInput["lifecycleEvent"]["archive"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.lifecycleEvent.archive.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.lifecycleEvent.get.invalidate({ systemId, eventId: variables.eventId });
      void utils.lifecycleEvent.list.invalidate({ systemId });
    },
  });
}

export function useRestoreLifecycleEvent(): TRPCMutation<
  RouterOutput["lifecycleEvent"]["restore"],
  RouterInput["lifecycleEvent"]["restore"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.lifecycleEvent.restore.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.lifecycleEvent.get.invalidate({ systemId, eventId: variables.eventId });
      void utils.lifecycleEvent.list.invalidate({ systemId });
    },
  });
}

export function useDeleteLifecycleEvent(): TRPCMutation<
  RouterOutput["lifecycleEvent"]["delete"],
  RouterInput["lifecycleEvent"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.lifecycleEvent.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.lifecycleEvent.get.invalidate({ systemId, eventId: variables.eventId });
      void utils.lifecycleEvent.list.invalidate({ systemId });
    },
  });
}
