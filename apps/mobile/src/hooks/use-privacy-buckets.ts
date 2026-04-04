import { trpc } from "@pluralscape/api-client/trpc";

import { useActiveSystemId } from "../providers/system-provider.js";

import {
  DEFAULT_LIST_LIMIT,
  type SystemIdOverride,
  type TRPCInfiniteQuery,
  type TRPCMutation,
  type TRPCQuery,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";

type BucketPage = RouterOutput["bucket"]["list"];
type Bucket = RouterOutput["bucket"]["get"];

interface BucketListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function usePrivacyBucket(
  bucketId: RouterInput["bucket"]["get"]["bucketId"],
  opts?: SystemIdOverride,
): TRPCQuery<Bucket> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  return trpc.bucket.get.useQuery({ systemId, bucketId });
}

export function usePrivacyBucketsList(opts?: BucketListOpts): TRPCInfiniteQuery<BucketPage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  return trpc.bucket.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      getNextPageParam: (lastPage: BucketPage) => lastPage.nextCursor,
    },
  );
}

export function useCreatePrivacyBucket(): TRPCMutation<
  RouterOutput["bucket"]["create"],
  RouterInput["bucket"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.bucket.create.useMutation({
    onSuccess: () => {
      void utils.bucket.list.invalidate({ systemId });
    },
  });
}

export function useUpdatePrivacyBucket(): TRPCMutation<
  RouterOutput["bucket"]["update"],
  RouterInput["bucket"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.bucket.update.useMutation({
    onSuccess: (_data, variables) => {
      void utils.bucket.get.invalidate({ systemId, bucketId: variables.bucketId });
      void utils.bucket.list.invalidate({ systemId });
    },
  });
}

export function useArchivePrivacyBucket(): TRPCMutation<
  RouterOutput["bucket"]["archive"],
  RouterInput["bucket"]["archive"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.bucket.archive.useMutation({
    onSuccess: (_data, variables) => {
      void utils.bucket.get.invalidate({ systemId, bucketId: variables.bucketId });
      void utils.bucket.list.invalidate({ systemId });
    },
  });
}

export function useRestorePrivacyBucket(): TRPCMutation<
  RouterOutput["bucket"]["restore"],
  RouterInput["bucket"]["restore"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.bucket.restore.useMutation({
    onSuccess: (_data, variables) => {
      void utils.bucket.get.invalidate({ systemId, bucketId: variables.bucketId });
      void utils.bucket.list.invalidate({ systemId });
    },
  });
}
