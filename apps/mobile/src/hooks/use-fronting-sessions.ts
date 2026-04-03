import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptFrontingSession,
  decryptFrontingSessionPage,
} from "@pluralscape/data/transforms/fronting-session";

import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import type { AppRouter, RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type { FrontingSession, FrontingSessionId, SystemId } from "@pluralscape/types";
import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseMutationResult,
  UseQueryResult,
} from "@tanstack/react-query";
import type { TRPCClientErrorLike } from "@trpc/client";
import type { TRPCHookResult } from "@trpc/react-query/shared";

/** Default page size for fronting session list queries. */
const DEFAULT_LIST_LIMIT = 20;

type RawSession = RouterOutput["frontingSession"]["get"];
type RawSessionPage = RouterOutput["frontingSession"]["list"];
type RawGetActive = RouterOutput["frontingSession"]["getActive"];
type TRPCError = TRPCClientErrorLike<AppRouter>;
type SessionPage = { readonly items: FrontingSession[]; readonly nextCursor: string | null };
type ActiveFrontersResult = {
  readonly sessions: FrontingSession[];
  readonly isCofronting: boolean;
  readonly entityMemberMap: Record<string, readonly string[]>;
};
type TRPCQuery<T> = TRPCHookResult & UseQueryResult<T, TRPCError>;
type TRPCInfiniteQuery<T> = TRPCHookResult & UseInfiniteQueryResult<InfiniteData<T>, TRPCError>;
type TRPCMutation<TData, TVars, TCtx = unknown> = TRPCHookResult &
  UseMutationResult<TData, TRPCError, TVars, TCtx>;

interface SystemIdOverride {
  readonly systemId?: SystemId;
}

interface FrontingSessionListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly activeOnly?: boolean;
  readonly includeArchived?: boolean;
}

export function useFrontingSession(
  sessionId: FrontingSessionId,
  opts?: SystemIdOverride,
): TRPCQuery<FrontingSession> {
  const systemId = opts?.systemId ?? useActiveSystemId();
  const masterKey = useMasterKey();

  return trpc.frontingSession.get.useQuery(
    { systemId, sessionId },
    {
      enabled: masterKey !== null,
      select: (raw: RawSession): FrontingSession => {
        if (masterKey === null) throw new Error("masterKey is null");
        return decryptFrontingSession(raw, masterKey);
      },
    },
  );
}

export function useFrontingSessionsList(
  opts?: FrontingSessionListOpts,
): TRPCInfiniteQuery<SessionPage> {
  const systemId = opts?.systemId ?? useActiveSystemId();
  const masterKey = useMasterKey();

  return trpc.frontingSession.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      activeOnly: opts?.activeOnly ?? false,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: RawSessionPage) => lastPage.nextCursor,
      select: (data: InfiniteData<RawSessionPage>): InfiniteData<SessionPage> => {
        if (masterKey === null) throw new Error("masterKey is null");
        const key = masterKey;
        return {
          ...data,
          pages: data.pages.map((page) => decryptFrontingSessionPage(page, key)),
        };
      },
    },
  );
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

type EndSessionContext = { readonly previousSession: RawSession | undefined };

export function useEndSession(): TRPCMutation<
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

  return trpc.frontingSession.getActive.useQuery(
    { systemId },
    {
      enabled: masterKey !== null,
      select: (raw: RawGetActive): ActiveFrontersResult => {
        if (masterKey === null) throw new Error("masterKey is null");
        const key = masterKey;
        return {
          sessions: raw.sessions.map((item) => decryptFrontingSession(item, key)),
          isCofronting: raw.isCofronting,
          entityMemberMap: raw.entityMemberMap,
        };
      },
    },
  );
}
