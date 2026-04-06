import { trpc } from "@pluralscape/api-client/trpc";
import { decryptSnapshot } from "@pluralscape/data/transforms/snapshot";

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
  SnapshotDecrypted,
  SnapshotPage as SnapshotRawPage,
  SnapshotRaw,
} from "@pluralscape/data/transforms/snapshot";
import type { SystemSnapshotId } from "@pluralscape/types";

interface SnapshotListOpts extends SystemIdOverride {
  readonly limit?: number;
}

export function useSnapshot(
  snapshotId: SystemSnapshotId,
  opts?: SystemIdOverride,
): DataQuery<SnapshotDecrypted> {
  return useOfflineFirstQuery<SnapshotRaw, SnapshotDecrypted>({
    queryKey: ["snapshots", snapshotId],
    table: "snapshots",
    entityId: snapshotId,
    // Snapshots are remote-only; local path never executes
    rowTransform: () => {
      throw new Error("snapshots are remote-only");
    },
    decrypt: decryptSnapshot,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.snapshot.get.useQuery(
        { systemId, snapshotId },
        { enabled, select },
      ) as DataQuery<SnapshotDecrypted>,
  });
}

export function useSnapshotsList(opts?: SnapshotListOpts): DataListQuery<SnapshotDecrypted> {
  return useOfflineFirstInfiniteQuery<SnapshotRaw, SnapshotDecrypted>({
    queryKey: ["snapshots", "list"],
    table: "snapshots",
    // Snapshots are remote-only; local path never executes
    rowTransform: () => {
      throw new Error("snapshots are remote-only");
    },
    decrypt: decryptSnapshot,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.snapshot.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
        },
        {
          enabled,
          getNextPageParam: (lastPage: SnapshotRawPage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<SnapshotDecrypted>,
  });
}

export function useCreateSnapshot(): TRPCMutation<
  RouterOutput["snapshot"]["create"],
  RouterInput["snapshot"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.snapshot.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.snapshot.list.invalidate({ systemId });
    },
  });
}

export function useDeleteSnapshot(): TRPCMutation<
  RouterOutput["snapshot"]["delete"],
  RouterInput["snapshot"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.snapshot.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.snapshot.get.invalidate({ systemId, snapshotId: variables.snapshotId });
      void utils.snapshot.list.invalidate({ systemId });
    },
  });
}
