import { trpc } from "@pluralscape/api-client/trpc";
import { decryptFriendDashboard } from "@pluralscape/data/transforms/friend-dashboard";
import { useCallback } from "react";

import { useBucketKeys } from "../providers/bucket-key-provider.js";

import { useRemoteOnlyQuery } from "./factories.js";

import type { DataQuery, TRPCQuery } from "./types.js";
import type { RouterOutput } from "@pluralscape/api-client/trpc";
import type { DecryptedFriendDashboard } from "@pluralscape/data/transforms/friend-dashboard";
import type { FriendConnectionId } from "@pluralscape/types";

/**
 * Fetch and decrypt a friend's dashboard using T2 bucket keys.
 *
 * Stays disabled until bucket keys are loaded and available.
 * The `select` callback decrypts all T2 blobs in-line using
 * the resolved bucket keys from the BucketKeyProvider.
 */
export function useFriendDashboard(
  connectionId: FriendConnectionId,
): TRPCQuery<DecryptedFriendDashboard> {
  const bucketKeys = useBucketKeys();

  const select = useCallback(
    (raw: Parameters<typeof decryptFriendDashboard>[0]): DecryptedFriendDashboard => {
      if (!bucketKeys) throw new Error("bucketKeys unavailable during select");
      return decryptFriendDashboard(raw, (bucketId) => {
        const entry = bucketKeys.get(bucketId);
        return entry?.key;
      });
    },
    [bucketKeys],
  );

  return trpc.friend.getDashboard.useQuery(
    { connectionId },
    {
      enabled: bucketKeys !== null && bucketKeys.size > 0,
      select,
    },
  );
}

export function useFriendDashboardSync(
  connectionId: FriendConnectionId,
): DataQuery<RouterOutput["friend"]["getDashboardSync"]> {
  return useRemoteOnlyQuery<RouterOutput["friend"]["getDashboardSync"]>({
    useRemote: ({ enabled }) =>
      trpc.friend.getDashboardSync.useQuery({ connectionId }, { enabled }) as DataQuery<
        RouterOutput["friend"]["getDashboardSync"]
      >,
  });
}
