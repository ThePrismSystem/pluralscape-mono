import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptFrontingSession,
  decryptFrontingSessionPage,
} from "@pluralscape/data/transforms/fronting-session";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { rowToFrontingSession } from "../data/row-transforms.js";
import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import {
  DEFAULT_LIST_LIMIT,
  type DataListQuery,
  type DataQuery,
  type SystemIdOverride,
  type TRPCError,
  type TRPCMutation,
  type TRPCQuery,
} from "./types.js";
import { useLocalDb, useQuerySource } from "./use-query-source.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  FrontingSessionPage as FrontingSessionRawPage,
  FrontingSessionRaw,
} from "@pluralscape/data/transforms/fronting-session";
import type { Archived, FrontingSession, FrontingSessionId } from "@pluralscape/types";
import type { InfiniteData, UseMutationResult } from "@tanstack/react-query";
import type { TRPCHookResult } from "@trpc/react-query/shared";

type TRPCMutationCtx<TData, TVars, TCtx> = TRPCHookResult &
  UseMutationResult<TData, TRPCError, TVars, TCtx>;

// Remains as RouterOutput because getActive returns a composite shape
// (sessions + isCofronting + entityMemberMap) with no transform-level wire type.
type RawGetActive = RouterOutput["frontingSession"]["getActive"];
type SessionPage = {
  readonly data: (FrontingSession | Archived<FrontingSession>)[];
  readonly nextCursor: string | null;
};
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
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectFrontingSession = useCallback(
    (raw: FrontingSessionRaw): FrontingSession | Archived<FrontingSession> => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptFrontingSession(raw, masterKey);
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["fronting_sessions", sessionId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const row = localDb.queryOne("SELECT * FROM fronting_sessions WHERE id = ?", [sessionId]);
      if (!row) throw new Error("Fronting session not found");
      return rowToFrontingSession(row);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.frontingSession.get.useQuery(
    { systemId, sessionId },
    {
      enabled: source === "remote" && masterKey !== null,
      select: selectFrontingSession,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useFrontingSessionsList(
  opts?: FrontingSessionListOpts,
): DataListQuery<FrontingSession | Archived<FrontingSession>> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectFrontingSessionsList = useCallback(
    (data: InfiniteData<FrontingSessionRawPage>): InfiniteData<SessionPage> => {
      if (masterKey === null) throw new Error("masterKey is null");
      const key = masterKey;
      return {
        ...data,
        pages: data.pages.map((page) => decryptFrontingSessionPage(page, key)),
      };
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: [
      "fronting_sessions",
      "list",
      systemId,
      opts?.activeOnly ?? false,
      opts?.includeArchived ?? false,
    ],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const activeOnly = opts?.activeOnly ?? false;
      const includeArchived = opts?.includeArchived ?? false;
      let sql = "SELECT * FROM fronting_sessions WHERE system_id = ?";
      if (activeOnly) {
        sql += " AND end_time IS NULL AND archived = 0";
      } else if (!includeArchived) {
        sql += " AND archived = 0";
      }
      sql += " ORDER BY created_at DESC";
      return localDb.queryAll(sql, [systemId]).map(rowToFrontingSession);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.frontingSession.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      activeOnly: opts?.activeOnly ?? false,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: source === "remote" && masterKey !== null,
      getNextPageParam: (lastPage: FrontingSessionRawPage) => lastPage.nextCursor,
      select: selectFrontingSessionsList,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

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

type EndSessionContext = { readonly previousSession: FrontingSessionRaw | undefined };

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
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.frontingSession.update.useMutation({
    onSuccess: (_data, variables) => {
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
