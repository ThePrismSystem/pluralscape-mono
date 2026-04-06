import { trpc } from "@pluralscape/api-client/trpc";

import { rowToPrivacyBucket } from "../data/row-transforms/index.js";

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
import type { ArchivedPrivacyBucket, BucketId, PrivacyBucket } from "@pluralscape/types";

type BucketRaw = RouterOutput["bucket"]["get"];
type BucketPage = RouterOutput["bucket"]["list"];

interface BucketListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function usePrivacyBucket(
  bucketId: BucketId,
  opts?: SystemIdOverride,
): DataQuery<PrivacyBucket | ArchivedPrivacyBucket> {
  return useOfflineFirstQuery<BucketRaw, PrivacyBucket | ArchivedPrivacyBucket>({
    queryKey: ["buckets", bucketId],
    table: "buckets",
    entityId: bucketId,
    rowTransform: rowToPrivacyBucket,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.bucket.get.useQuery({ systemId, bucketId }, { enabled, select }) as DataQuery<
        PrivacyBucket | ArchivedPrivacyBucket
      >,
  });
}

export function usePrivacyBucketsList(
  opts?: BucketListOpts,
): DataListQuery<PrivacyBucket | ArchivedPrivacyBucket> {
  return useOfflineFirstInfiniteQuery<BucketRaw, PrivacyBucket | ArchivedPrivacyBucket>({
    queryKey: ["buckets", "list", opts?.includeArchived ?? false],
    table: "buckets",
    rowTransform: rowToPrivacyBucket,
    includeArchived: opts?.includeArchived,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.bucket.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
          includeArchived: opts?.includeArchived ?? false,
        },
        {
          enabled,
          getNextPageParam: (lastPage: BucketPage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<PrivacyBucket | ArchivedPrivacyBucket>,
  });
}

export function useCreatePrivacyBucket(): TRPCMutation<
  RouterOutput["bucket"]["create"],
  RouterInput["bucket"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.bucket.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.bucket.list.invalidate({ systemId });
    },
  });
}

export function useUpdatePrivacyBucket(): TRPCMutation<
  RouterOutput["bucket"]["update"],
  RouterInput["bucket"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.bucket.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.bucket.get.invalidate({ systemId, bucketId: variables.bucketId });
      void utils.bucket.list.invalidate({ systemId });
    },
  });
}

export function useArchivePrivacyBucket(): TRPCMutation<
  RouterOutput["bucket"]["archive"],
  RouterInput["bucket"]["archive"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.bucket.archive.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.bucket.get.invalidate({ systemId, bucketId: variables.bucketId });
      void utils.bucket.list.invalidate({ systemId });
    },
  });
}

export function useRestorePrivacyBucket(): TRPCMutation<
  RouterOutput["bucket"]["restore"],
  RouterInput["bucket"]["restore"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.bucket.restore.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.bucket.get.invalidate({ systemId, bucketId: variables.bucketId });
      void utils.bucket.list.invalidate({ systemId });
    },
  });
}

export function useDeletePrivacyBucket(): TRPCMutation<
  RouterOutput["bucket"]["delete"],
  RouterInput["bucket"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.bucket.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.bucket.get.invalidate({ systemId, bucketId: variables.bucketId });
      void utils.bucket.list.invalidate({ systemId });
    },
  });
}
