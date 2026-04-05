import { trpc } from "@pluralscape/api-client/trpc";
import { useQuery } from "@tanstack/react-query";

import { rowToPrivacyBucket } from "../data/row-transforms.js";
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
import type { ArchivedPrivacyBucket, BucketId, PrivacyBucket } from "@pluralscape/types";

type BucketRemote = RouterOutput["bucket"]["get"];
type BucketPage = RouterOutput["bucket"]["list"];

interface BucketListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function usePrivacyBucket(
  bucketId: BucketId,
  opts?: SystemIdOverride,
): DataQuery<PrivacyBucket | ArchivedPrivacyBucket | BucketRemote> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  const localQuery = useQuery({
    queryKey: ["buckets", bucketId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const row = localDb.queryOne("SELECT * FROM buckets WHERE id = ?", [bucketId]);
      if (!row) throw new Error("Privacy bucket not found");
      return rowToPrivacyBucket(row);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.bucket.get.useQuery(
    { systemId, bucketId },
    { enabled: source === "remote" },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function usePrivacyBucketsList(
  opts?: BucketListOpts,
):
  | DataListQuery<PrivacyBucket | ArchivedPrivacyBucket>
  | ReturnType<typeof trpc.bucket.list.useInfiniteQuery> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  const localQuery = useQuery({
    queryKey: ["buckets", "list", systemId, opts?.includeArchived ?? false],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const includeArchived = opts?.includeArchived ?? false;
      const sql = includeArchived
        ? "SELECT * FROM buckets WHERE system_id = ?"
        : "SELECT * FROM buckets WHERE system_id = ? AND archived = 0";
      return localDb.queryAll(sql, [systemId]).map(rowToPrivacyBucket);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.bucket.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: source === "remote",
      getNextPageParam: (lastPage: BucketPage) => lastPage.nextCursor,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
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
