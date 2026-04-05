import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptTimerConfig,
  decryptTimerConfigPage,
} from "@pluralscape/data/transforms/timer-check-in";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { rowToCheckInRecord, rowToTimer } from "../data/row-transforms.js";
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
import type { InfiniteData } from "@tanstack/react-query";

type TimerPage = {
  readonly data: (TimerConfig | Archived<TimerConfig>)[];
  readonly nextCursor: string | null;
};

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
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectTimerConfig = useCallback(
    (raw: TimerConfigRaw): TimerConfig | Archived<TimerConfig> => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptTimerConfig(raw, masterKey);
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["timer_configs", timerId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const row = localDb.queryOne("SELECT * FROM timer_configs WHERE id = ?", [timerId]);
      if (!row) throw new Error("Timer config not found");
      return rowToTimer(row);
    },
    enabled: source === "local",
  });

  const remoteQuery = trpc.timerConfig.get.useQuery(
    { systemId, timerId },
    {
      enabled: source === "remote" && masterKey !== null,
      select: selectTimerConfig,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useTimerConfigsList(
  opts?: TimerConfigListOpts,
): DataListQuery<TimerConfig | Archived<TimerConfig>> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectTimerConfigsList = useCallback(
    (data: InfiniteData<TimerConfigPage>): InfiniteData<TimerPage> => {
      if (masterKey === null) throw new Error("masterKey is null");
      const key = masterKey;
      return {
        ...data,
        pages: data.pages.map((page) => decryptTimerConfigPage(page, key)),
      };
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["timer_configs", "list", systemId, opts?.includeArchived ?? false],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const includeArchived = opts?.includeArchived ?? false;
      const sql = includeArchived
        ? "SELECT * FROM timer_configs WHERE system_id = ?"
        : "SELECT * FROM timer_configs WHERE system_id = ? AND archived = 0";
      return localDb.queryAll(sql, [systemId]).map(rowToTimer);
    },
    enabled: source === "local",
  });

  const remoteQuery = trpc.timerConfig.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: source === "remote" && masterKey !== null,
      getNextPageParam: (lastPage: TimerConfigPage) => lastPage.nextCursor,
      select: selectTimerConfigsList,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useCreateTimer(): TRPCMutation<
  RouterOutput["timerConfig"]["create"],
  RouterInput["timerConfig"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.timerConfig.create.useMutation({
    onSuccess: () => {
      void utils.timerConfig.list.invalidate({ systemId });
    },
  });
}

export function useUpdateTimer(): TRPCMutation<
  RouterOutput["timerConfig"]["update"],
  RouterInput["timerConfig"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.timerConfig.update.useMutation({
    onSuccess: (_data, variables) => {
      void utils.timerConfig.get.invalidate({ systemId, timerId: variables.timerId });
      void utils.timerConfig.list.invalidate({ systemId });
    },
  });
}

export function useDeleteTimer(): TRPCMutation<
  RouterOutput["timerConfig"]["delete"],
  RouterInput["timerConfig"]["delete"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.timerConfig.delete.useMutation({
    onSuccess: (_data, variables) => {
      void utils.timerConfig.get.invalidate({ systemId, timerId: variables.timerId });
      void utils.timerConfig.list.invalidate({ systemId });
    },
  });
}

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
      return localDb.queryAll(sql, params).map(rowToCheckInRecord);
    },
    enabled: source === "local",
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
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.checkInRecord.create.useMutation({
    onSuccess: () => {
      void utils.checkInRecord.list.invalidate({ systemId });
    },
  });
}

export function useMarkCheckInResponded(): TRPCMutation<
  RouterOutput["checkInRecord"]["respond"],
  RouterInput["checkInRecord"]["respond"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.checkInRecord.respond.useMutation({
    onSuccess: (_data, variables) => {
      void utils.checkInRecord.get.invalidate({ systemId, recordId: variables.recordId });
      void utils.checkInRecord.list.invalidate({ systemId });
    },
  });
}

export function useMarkCheckInDismissed(): TRPCMutation<
  RouterOutput["checkInRecord"]["dismiss"],
  RouterInput["checkInRecord"]["dismiss"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.checkInRecord.dismiss.useMutation({
    onSuccess: (_data, variables) => {
      void utils.checkInRecord.get.invalidate({ systemId, recordId: variables.recordId });
      void utils.checkInRecord.list.invalidate({ systemId });
    },
  });
}
