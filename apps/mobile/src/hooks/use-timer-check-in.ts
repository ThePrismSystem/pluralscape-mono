import { trpc } from "@pluralscape/api-client/trpc";
import { decryptTimerConfig } from "@pluralscape/data/transforms/timer-check-in";
import { useQuery } from "@tanstack/react-query";

import { rowToCheckInRecord, rowToTimer } from "../data/row-transforms.js";
import { useActiveSystemId } from "../providers/system-provider.js";

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
import { useLocalDb, useQuerySource } from "./use-query-source.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  CheckInRecordPage,
  TimerConfigPage,
  TimerConfigRaw,
} from "@pluralscape/data/transforms/timer-check-in";
import type {
  ArchivedCheckInRecord,
  Archived,
  CheckInRecord,
  TimerConfig,
  TimerId,
} from "@pluralscape/types";


interface TimerConfigListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

interface CheckInHistoryOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly timerConfigId?: TimerId;
  readonly pending?: boolean;
  readonly includeArchived?: boolean;
}

export function useTimerConfig(
  timerId: TimerId,
  opts?: SystemIdOverride,
): DataQuery<TimerConfig | Archived<TimerConfig>> {
  return useOfflineFirstQuery<TimerConfigRaw, TimerConfig | Archived<TimerConfig>>({
    queryKey: ["timer_configs", timerId],
    table: "timer_configs",
    entityId: timerId,
    rowTransform: rowToTimer,
    decrypt: decryptTimerConfig,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.timerConfig.get.useQuery({ systemId, timerId }, { enabled, select }) as DataQuery<
        TimerConfig | Archived<TimerConfig>
      >,
  });
}

export function useTimerConfigsList(
  opts?: TimerConfigListOpts,
): DataListQuery<TimerConfig | Archived<TimerConfig>> {
  return useOfflineFirstInfiniteQuery<TimerConfigRaw, TimerConfig | Archived<TimerConfig>>({
    queryKey: ["timer_configs", "list", opts?.systemId, opts?.includeArchived ?? false],
    table: "timer_configs",
    rowTransform: rowToTimer,
    decrypt: decryptTimerConfig,
    includeArchived: opts?.includeArchived,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.timerConfig.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
          includeArchived: opts?.includeArchived ?? false,
        },
        {
          enabled,
          getNextPageParam: (lastPage: TimerConfigPage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<TimerConfig | Archived<TimerConfig>>,
  });
}

export function useCreateTimer(): TRPCMutation<
  RouterOutput["timerConfig"]["create"],
  RouterInput["timerConfig"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.timerConfig.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.timerConfig.list.invalidate({ systemId });
    },
  });
}

export function useUpdateTimer(): TRPCMutation<
  RouterOutput["timerConfig"]["update"],
  RouterInput["timerConfig"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.timerConfig.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.timerConfig.get.invalidate({ systemId, timerId: variables.timerId });
      void utils.timerConfig.list.invalidate({ systemId });
    },
  });
}

export function useDeleteTimer(): TRPCMutation<
  RouterOutput["timerConfig"]["delete"],
  RouterInput["timerConfig"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.timerConfig.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.timerConfig.get.invalidate({ systemId, timerId: variables.timerId });
      void utils.timerConfig.list.invalidate({ systemId });
    },
  });
}

// ── Check-in records (plaintext) ────────────────────────────────────

/**
 * Check-in history is plaintext with custom filter logic (pending, timerConfigId)
 * that doesn't map cleanly to the infinite query factory's local SQL generation.
 * Kept as manual offline-first branching.
 */
export function useCheckInHistory(
  opts?: CheckInHistoryOpts,
): DataListQuery<CheckInRecord | ArchivedCheckInRecord> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  const localQuery = useQuery({
    queryKey: [
      "check_in_records",
      "list",
      systemId,
      opts?.timerConfigId ?? null,
      opts?.pending ?? null,
      opts?.includeArchived ?? false,
    ],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const includeArchived = opts?.includeArchived ?? false;
      const params: unknown[] = [systemId];
      let sql = "SELECT * FROM check_in_records WHERE system_id = ?";
      if (opts?.timerConfigId !== undefined) {
        sql += " AND timer_config_id = ?";
        params.push(opts.timerConfigId);
      }
      if (opts?.pending === true) {
        sql += " AND responded_at IS NULL AND dismissed = 0";
      }
      if (!includeArchived) {
        sql += " AND archived = 0";
      }
      sql += " ORDER BY created_at DESC";
      return localDb.queryAll(sql, params).map(rowToCheckInRecord);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.checkInRecord.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      timerConfigId: opts?.timerConfigId,
      pending: opts?.pending,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: source === "remote",
      getNextPageParam: (lastPage: CheckInRecordPage) => lastPage.nextCursor,
    },
  );

  // The remote query returns the raw wire type (CheckInRecordRaw) which is
  // structurally compatible with CheckInRecord at runtime. A select transform
  // will be added when check-in record encryption is implemented.
  return (source === "local" ? localQuery : remoteQuery) as DataListQuery<
    CheckInRecord | ArchivedCheckInRecord
  >;
}

export function useCreateCheckIn(): TRPCMutation<
  RouterOutput["checkInRecord"]["create"],
  RouterInput["checkInRecord"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.checkInRecord.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.checkInRecord.list.invalidate({ systemId });
    },
  });
}

export function useMarkCheckInResponded(): TRPCMutation<
  RouterOutput["checkInRecord"]["respond"],
  RouterInput["checkInRecord"]["respond"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.checkInRecord.respond.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.checkInRecord.get.invalidate({ systemId, recordId: variables.recordId });
      void utils.checkInRecord.list.invalidate({ systemId });
    },
  });
}

export function useMarkCheckInDismissed(): TRPCMutation<
  RouterOutput["checkInRecord"]["dismiss"],
  RouterInput["checkInRecord"]["dismiss"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.checkInRecord.dismiss.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.checkInRecord.get.invalidate({ systemId, recordId: variables.recordId });
      void utils.checkInRecord.list.invalidate({ systemId });
    },
  });
}
