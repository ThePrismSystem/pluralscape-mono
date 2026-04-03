import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptTimerConfig,
  decryptTimerConfigPage,
} from "@pluralscape/data/transforms/timer-check-in";

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
import type { Archived, TimerConfig, TimerId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type RawTimerConfig = RouterOutput["timerConfig"]["get"];
type RawTimerConfigPage = RouterOutput["timerConfig"]["list"];
type RawCheckInPage = RouterOutput["checkInRecord"]["list"];
type CheckInRecord = RouterOutput["checkInRecord"]["get"];
type TimerPage = {
  readonly data: (TimerConfig | Archived<TimerConfig>)[];
  readonly nextCursor: string | null;
};
type CheckInPage = {
  readonly data: CheckInRecord[];
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
): TRPCQuery<TimerConfig | Archived<TimerConfig>> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  return trpc.timerConfig.get.useQuery(
    { systemId, timerId },
    {
      enabled: masterKey !== null,
      select: (raw: RawTimerConfig): TimerConfig | Archived<TimerConfig> => {
        if (masterKey === null) throw new Error("masterKey is null");
        return decryptTimerConfig(raw, masterKey);
      },
    },
  );
}

export function useTimerConfigsList(opts?: TimerConfigListOpts): TRPCInfiniteQuery<TimerPage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  return trpc.timerConfig.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: RawTimerConfigPage) => lastPage.nextCursor,
      select: (data: InfiniteData<RawTimerConfigPage>): InfiniteData<TimerPage> => {
        if (masterKey === null) throw new Error("masterKey is null");
        const key = masterKey;
        return {
          ...data,
          pages: data.pages.map((page) => decryptTimerConfigPage(page, key)),
        };
      },
    },
  );
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

export function useCheckInHistory(opts?: CheckInHistoryOpts): TRPCInfiniteQuery<CheckInPage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  return trpc.checkInRecord.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      timerConfigId: opts?.timerConfigId,
      pending: opts?.pending,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      getNextPageParam: (lastPage: RawCheckInPage) => lastPage.nextCursor,
      select: (data: InfiniteData<RawCheckInPage>): InfiniteData<CheckInPage> => ({
        ...data,
        pages: data.pages.map((page) => ({
          data: [...page.data],
          nextCursor: page.nextCursor,
        })),
      }),
    },
  );
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
