import { trpc } from "@pluralscape/api-client/trpc";

import { useRemoteOnlyQuery, useDomainMutation } from "./factories.js";
import {
  DEFAULT_LIST_LIMIT,
  type DataListQuery,
  type DataQuery,
  type SystemIdOverride,
  type TRPCMutation,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";

// ---------------------------------------------------------------------------
// Shared types — use RouterOutput to match what the API actually returns
// ---------------------------------------------------------------------------

type SystemGetResult = RouterOutput["system"]["get"];
type SystemListItem = RouterOutput["system"]["list"]["data"][number];

interface SystemListOpts {
  readonly limit?: number;
}

// ---------------------------------------------------------------------------
// System queries
// ---------------------------------------------------------------------------

export function useSystem(opts?: SystemIdOverride): DataQuery<SystemGetResult> {
  return useRemoteOnlyQuery<SystemGetResult>({
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled }) =>
      trpc.system.get.useQuery({ systemId }, { enabled }) as DataQuery<SystemGetResult>,
  });
}

/**
 * Lists all systems for the authenticated account.
 * Uses `protectedProcedure` (account-scoped) — no systemId required.
 * Plain tRPC hook, not a factory, because this is both account-scoped and remote-only.
 */
export function useSystemsList(opts?: SystemListOpts): DataListQuery<SystemListItem> {
  return trpc.system.list.useInfiniteQuery(
    { limit: opts?.limit ?? DEFAULT_LIST_LIMIT },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  ) as DataListQuery<SystemListItem>;
}

// ---------------------------------------------------------------------------
// System mutations
// ---------------------------------------------------------------------------

export function useCreateSystem(): TRPCMutation<
  RouterOutput["system"]["create"],
  RouterInput["system"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.system.create.useMutation(mutOpts),
    onInvalidate: (utils) => {
      void utils.system.list.invalidate();
    },
  });
}

export function useUpdateSystem(): TRPCMutation<
  RouterOutput["system"]["update"],
  RouterInput["system"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.system.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.system.get.invalidate({ systemId });
      void utils.system.list.invalidate();
    },
  });
}

export function useArchiveSystem(): TRPCMutation<
  RouterOutput["system"]["archive"],
  RouterInput["system"]["archive"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.system.archive.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.system.get.invalidate({ systemId });
      void utils.system.list.invalidate();
    },
  });
}

export function useDuplicateSystem(): TRPCMutation<
  RouterOutput["system"]["duplicate"],
  RouterInput["system"]["duplicate"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.system.duplicate.useMutation(mutOpts),
    onInvalidate: (utils) => {
      void utils.system.list.invalidate();
    },
  });
}

/**
 * Purge is destructive — deletes the entire system and all associated data.
 * Uses direct tRPC (not useDomainMutation) because purge requires broad cache
 * invalidation of all domain caches, not scoped invalidation.
 */
export function usePurgeSystem(): TRPCMutation<
  RouterOutput["system"]["purge"],
  RouterInput["system"]["purge"]
> {
  const utils = trpc.useUtils();

  return trpc.system.purge.useMutation({
    onSuccess: () => {
      // Purge wipes the entire system — invalidate all cached data
      void utils.invalidate();
    },
  });
}
