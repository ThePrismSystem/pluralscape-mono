import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptLifecycleEvent,
  decryptLifecycleEventPage,
} from "@pluralscape/data/transforms/lifecycle-event";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { rowToLifecycleEvent } from "../data/row-transforms.js";
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
): DataQuery<LifecycleEventWithArchive> {
  const source = useQuerySource();
  const localDb = useLocalDb();
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

  const localQuery = useQuery({
    queryKey: ["lifecycle-events", eventId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const row = localDb.queryOne("SELECT * FROM lifecycle_events WHERE id = ?", [eventId]);
      if (!row) throw new Error("LifecycleEvent not found");
      return rowToLifecycleEvent(row);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.lifecycleEvent.get.useQuery(
    { systemId, eventId },
    {
      enabled: source === "remote" && masterKey !== null,
      select: selectEvent,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useLifecycleEventsList(
  opts?: LifecycleEventListOpts,
): DataListQuery<LifecycleEventWithArchive> {
  const source = useQuerySource();
  const localDb = useLocalDb();
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

  const localQuery = useQuery({
    queryKey: ["lifecycle-events", "list", systemId, opts?.includeArchived ?? false],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const includeArchived = opts?.includeArchived ?? false;
      const sql = includeArchived
        ? "SELECT * FROM lifecycle_events WHERE system_id = ?"
        : "SELECT * FROM lifecycle_events WHERE system_id = ? AND archived = 0";
      return localDb.queryAll(sql, [systemId]).map(rowToLifecycleEvent);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.lifecycleEvent.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      eventType: opts?.eventType,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: source === "remote" && masterKey !== null,
      getNextPageParam: (lastPage: LifecycleEventRawPage) => lastPage.nextCursor,
      select: selectPage,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
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
