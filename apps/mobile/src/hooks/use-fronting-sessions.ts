import { trpc } from "@pluralscape/api-client/trpc";
import { decryptFrontingSession } from "@pluralscape/data/transforms/fronting-session";
import { useCallback } from "react";

import { rowToFrontingSession } from "../data/row-transforms/index.js";
import { useMasterKey } from "../providers/crypto-provider.js";
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
  type TRPCMutationCtx,
  type TRPCQuery,
} from "./types.js";

import type { LocalDatabase } from "../data/local-database.js";
import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type { FrontingSessionPage as FrontingSessionWirePage } from "@pluralscape/data/transforms/fronting-session";
import type {
  Archived,
  FrontingSession,
  FrontingSessionId,
  FrontingSessionWire,
  SystemId,
} from "@pluralscape/types";

// Remains as RouterOutput because getActive returns a composite shape
// (sessions + isCofronting + entityMemberMap) with no transform-level wire type.
type RawGetActive = RouterOutput["frontingSession"]["getActive"];
type ActiveFrontersResult = {
  readonly sessions: (FrontingSession | Archived<FrontingSession>)[];
  readonly isCofronting: boolean;
  readonly entityMemberMap: Record<string, readonly string[]>;
};

interface FrontingSessionListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly activeOnly?: boolean;
  readonly includeArchived?: boolean;
}

export function useFrontingSession(
  sessionId: FrontingSessionId,
  opts?: SystemIdOverride,
): DataQuery<FrontingSession | Archived<FrontingSession>> {
  return useOfflineFirstQuery<FrontingSessionWire, FrontingSession | Archived<FrontingSession>>({
    queryKey: ["fronting_sessions", sessionId],
    table: "fronting_sessions",
    entityId: sessionId,
    rowTransform: rowToFrontingSession,
    decrypt: decryptFrontingSession,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.frontingSession.get.useQuery({ systemId, sessionId }, { enabled, select }) as DataQuery<
        FrontingSession | Archived<FrontingSession>
      >,
  });
}

export function useFrontingSessionsList(
  opts?: FrontingSessionListOpts,
): DataListQuery<FrontingSession | Archived<FrontingSession>> {
  return useOfflineFirstInfiniteQuery<
    FrontingSessionWire,
    FrontingSession | Archived<FrontingSession>
  >({
    queryKey: [
      "fronting_sessions",
      "list",
      opts?.activeOnly ?? false,
      opts?.includeArchived ?? false,
    ],
    table: "fronting_sessions",
    rowTransform: rowToFrontingSession,
    decrypt: decryptFrontingSession,
    includeArchived: opts?.includeArchived,
    systemIdOverride: opts,
    localQueryFn: async (localDb: LocalDatabase, systemId: SystemId, pagination) => {
      const activeOnly = opts?.activeOnly ?? false;
      const includeArchived = opts?.includeArchived ?? false;
      let sql = "SELECT * FROM fronting_sessions WHERE system_id = ?";
      if (activeOnly) {
        sql += " AND end_time IS NULL AND archived = 0";
      } else if (!includeArchived) {
        sql += " AND archived = 0";
      }
      sql += ` ORDER BY created_at DESC LIMIT ${String(pagination.limit)} OFFSET ${String(pagination.offset)}`;
      const rows = await localDb.queryAll(sql, [systemId]);
      return rows.map(rowToFrontingSession);
    },
    useRemote: ({ systemId, enabled, select }) =>
      trpc.frontingSession.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
          activeOnly: opts?.activeOnly ?? false,
          includeArchived: opts?.includeArchived ?? false,
        },
        {
          enabled,
          getNextPageParam: (lastPage: FrontingSessionWirePage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<FrontingSession | Archived<FrontingSession>>,
  });
}

// Kept as manual tRPC mutation — onMutate cancels in-flight queries and
// onSettled (not onSuccess) fires invalidation on both success and error,
// which does not map to the useDomainMutation factory's onSuccess-only pattern.
export function useStartSession(): TRPCMutation<
  RouterOutput["frontingSession"]["create"],
  RouterInput["frontingSession"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.frontingSession.create.useMutation({
    onMutate: async () => {
      await utils.frontingSession.list.cancel({ systemId });
    },
    onSettled: () => {
      void utils.frontingSession.list.invalidate({ systemId });
      void utils.frontingSession.getActive.invalidate({ systemId });
    },
  });
}

type EndSessionContext = {
  readonly previousSession: RouterOutput["frontingSession"]["get"] | undefined;
};

// Kept as manual tRPC mutation — optimistic update with onMutate/onError/onSettled
// rollback does not fit the useDomainMutation factory pattern.
export function useEndSession(): TRPCMutationCtx<
  RouterOutput["frontingSession"]["end"],
  RouterInput["frontingSession"]["end"],
  EndSessionContext
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.frontingSession.end.useMutation({
    onMutate: async (variables): Promise<EndSessionContext> => {
      await utils.frontingSession.get.cancel({ systemId, sessionId: variables.sessionId });
      const previousSession = utils.frontingSession.get.getData({
        systemId,
        sessionId: variables.sessionId,
      });
      return { previousSession };
    },
    onError: (_err, variables, context) => {
      if (context?.previousSession !== undefined) {
        utils.frontingSession.get.setData(
          { systemId, sessionId: variables.sessionId },
          context.previousSession,
        );
      }
    },
    onSettled: (_data, _err, variables) => {
      void utils.frontingSession.list.invalidate({ systemId });
      void utils.frontingSession.get.invalidate({ systemId, sessionId: variables.sessionId });
      void utils.frontingSession.getActive.invalidate({ systemId });
    },
  });
}

export function useUpdateSession(): TRPCMutation<
  RouterOutput["frontingSession"]["update"],
  RouterInput["frontingSession"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.frontingSession.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.frontingSession.get.invalidate({ systemId, sessionId: variables.sessionId });
      void utils.frontingSession.list.invalidate({ systemId });
    },
  });
}

export function useArchiveFrontingSession(): TRPCMutation<
  RouterOutput["frontingSession"]["archive"],
  RouterInput["frontingSession"]["archive"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.frontingSession.archive.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.frontingSession.get.invalidate({ systemId, sessionId: variables.sessionId });
      void utils.frontingSession.list.invalidate({ systemId });
    },
  });
}

export function useRestoreFrontingSession(): TRPCMutation<
  RouterOutput["frontingSession"]["restore"],
  RouterInput["frontingSession"]["restore"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.frontingSession.restore.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.frontingSession.get.invalidate({ systemId, sessionId: variables.sessionId });
      void utils.frontingSession.list.invalidate({ systemId });
    },
  });
}

export function useDeleteFrontingSession(): TRPCMutation<
  RouterOutput["frontingSession"]["delete"],
  RouterInput["frontingSession"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.frontingSession.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.frontingSession.get.invalidate({ systemId, sessionId: variables.sessionId });
      void utils.frontingSession.list.invalidate({ systemId });
    },
  });
}

export function useActiveFronters(): TRPCQuery<ActiveFrontersResult> {
  const systemId = useActiveSystemId();
  const masterKey = useMasterKey();

  const selectActiveFronters = useCallback(
    (raw: RawGetActive): ActiveFrontersResult => {
      if (masterKey === null) throw new Error("masterKey is null");
      const key = masterKey;
      return {
        sessions: raw.sessions.map((item) => decryptFrontingSession(item, key)),
        isCofronting: raw.isCofronting,
        entityMemberMap: raw.entityMemberMap,
      };
    },
    [masterKey],
  );

  return trpc.frontingSession.getActive.useQuery(
    { systemId },
    {
      enabled: masterKey !== null,
      select: selectActiveFronters,
    },
  );
}
