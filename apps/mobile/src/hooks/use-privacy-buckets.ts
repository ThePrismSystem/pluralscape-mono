import { trpc } from "@pluralscape/api-client/trpc";

import { rowToPrivacyBucket } from "../data/row-transforms/index.js";

import {
  useOfflineFirstQuery,
  useOfflineFirstInfiniteQuery,
  useDomainMutation,
  useRemoteOnlyQuery,
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

// ── Content tagging ──────────────────────────────────────────────────────────

export function useTagBucketContent(): TRPCMutation<
  RouterOutput["bucket"]["tagContent"],
  RouterInput["bucket"]["tagContent"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.bucket.tagContent.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.bucket.listTags.invalidate({ systemId, bucketId: variables.bucketId });
      void utils.bucket.get.invalidate({ systemId, bucketId: variables.bucketId });
    },
  });
}

export function useUntagBucketContent(): TRPCMutation<
  RouterOutput["bucket"]["untagContent"],
  RouterInput["bucket"]["untagContent"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.bucket.untagContent.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.bucket.listTags.invalidate({ systemId, bucketId: variables.bucketId });
      void utils.bucket.get.invalidate({ systemId, bucketId: variables.bucketId });
    },
  });
}

export function useListBucketTags(
  bucketId: BucketId,
  opts?: SystemIdOverride,
): DataQuery<RouterOutput["bucket"]["listTags"]> {
  return useRemoteOnlyQuery({
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled }) =>
      trpc.bucket.listTags.useQuery({ systemId, bucketId }, { enabled }) as DataQuery<
        RouterOutput["bucket"]["listTags"]
      >,
  });
}

// ── Key rotation ─────────────────────────────────────────────────────────────

export function useInitiateBucketRotation(): TRPCMutation<
  RouterOutput["bucket"]["initiateRotation"],
  RouterInput["bucket"]["initiateRotation"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.bucket.initiateRotation.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.bucket.get.invalidate({ systemId, bucketId: variables.bucketId });
      void utils.bucket.rotationProgress.invalidate({ systemId, bucketId: variables.bucketId });
    },
  });
}

export function useBucketRotationProgress(
  bucketId: BucketId,
  rotationId: string,
  opts?: SystemIdOverride,
): DataQuery<RouterOutput["bucket"]["rotationProgress"]> {
  return useRemoteOnlyQuery({
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled }) =>
      trpc.bucket.rotationProgress.useQuery(
        { systemId, bucketId, rotationId },
        { enabled },
      ) as DataQuery<RouterOutput["bucket"]["rotationProgress"]>,
  });
}

export function useClaimRotationChunk(): TRPCMutation<
  RouterOutput["bucket"]["claimRotationChunk"],
  RouterInput["bucket"]["claimRotationChunk"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.bucket.claimRotationChunk.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.bucket.rotationProgress.invalidate({ systemId, bucketId: variables.bucketId });
    },
  });
}

export function useCompleteRotationChunk(): TRPCMutation<
  RouterOutput["bucket"]["completeRotationChunk"],
  RouterInput["bucket"]["completeRotationChunk"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.bucket.completeRotationChunk.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.bucket.rotationProgress.invalidate({ systemId, bucketId: variables.bucketId });
    },
  });
}

export function useRetryBucketRotation(): TRPCMutation<
  RouterOutput["bucket"]["retryRotation"],
  RouterInput["bucket"]["retryRotation"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.bucket.retryRotation.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.bucket.rotationProgress.invalidate({ systemId, bucketId: variables.bucketId });
    },
  });
}

// ── Export ───────────────────────────────────────────────────────────────────

export function useBucketExportManifest(
  bucketId: BucketId,
  opts?: SystemIdOverride,
): DataQuery<RouterOutput["bucket"]["exportManifest"]> {
  return useRemoteOnlyQuery({
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled }) =>
      trpc.bucket.exportManifest.useQuery({ systemId, bucketId }, { enabled }) as DataQuery<
        RouterOutput["bucket"]["exportManifest"]
      >,
  });
}

export function useBucketExportPage(
  bucketId: BucketId,
  pageParams: Omit<RouterInput["bucket"]["exportPage"], "systemId" | "bucketId">,
  opts?: SystemIdOverride,
): DataQuery<RouterOutput["bucket"]["exportPage"]> {
  return useRemoteOnlyQuery({
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled }) =>
      trpc.bucket.exportPage.useQuery(
        { systemId, bucketId, ...pageParams },
        { enabled },
      ) as DataQuery<RouterOutput["bucket"]["exportPage"]>,
  });
}

// ── Friend assignment ────────────────────────────────────────────────────────

export function useAssignBucketFriend(): TRPCMutation<
  RouterOutput["bucket"]["assignFriend"],
  RouterInput["bucket"]["assignFriend"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.bucket.assignFriend.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.bucket.listFriendAssignments.invalidate({
        systemId,
        bucketId: variables.bucketId,
      });
      void utils.bucket.get.invalidate({ systemId, bucketId: variables.bucketId });
    },
  });
}

export function useUnassignBucketFriend(): TRPCMutation<
  RouterOutput["bucket"]["unassignFriend"],
  RouterInput["bucket"]["unassignFriend"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.bucket.unassignFriend.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.bucket.listFriendAssignments.invalidate({
        systemId,
        bucketId: variables.bucketId,
      });
      void utils.bucket.get.invalidate({ systemId, bucketId: variables.bucketId });
    },
  });
}

export function useListBucketFriendAssignments(
  bucketId: BucketId,
  opts?: SystemIdOverride,
): DataQuery<RouterOutput["bucket"]["listFriendAssignments"]> {
  return useRemoteOnlyQuery({
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled }) =>
      trpc.bucket.listFriendAssignments.useQuery({ systemId, bucketId }, { enabled }) as DataQuery<
        RouterOutput["bucket"]["listFriendAssignments"]
      >,
  });
}
