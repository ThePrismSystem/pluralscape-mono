import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";


import { useRestClient } from "../providers/rest-client-provider.js";

import type {
  FriendExportEntityType,
  FriendExportManifestResponse,
  FriendExportPageResponse,
} from "@pluralscape/types";
import type { FriendConnectionId } from "@pluralscape/types";
import type { UseQueryResult } from "@tanstack/react-query";

/** 5 minutes — ETag handles freshness, so staleTime can be generous. */
const STALE_TIME_MS = 5 * 60 * 1_000;

/**
 * Fetch the friend export manifest with ETag-based conditional caching.
 *
 * Uses the REST client (not tRPC) because the endpoint returns ETags and
 * supports 304 Not Modified responses for bandwidth efficiency.
 *
 * Returns raw (encrypted) data — the consumer decrypts per-entity using bucket keys.
 */
export function useFriendExportManifest(
  connectionId: FriendConnectionId,
): UseQueryResult<FriendExportManifestResponse> {
  const client = useRestClient();
  const etagRef = useRef<string | null>(null);

  return useQuery<FriendExportManifestResponse>({
    queryKey: ["friend-export-manifest", connectionId],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      if (etagRef.current) {
        headers["If-None-Match"] = etagRef.current;
      }

      const { data, response } = await client.GET(
        "/account/friends/{connectionId}/export/manifest",
        {
          params: {
            path: { connectionId },
            header: { "If-None-Match": etagRef.current ?? undefined },
          },
        },
      );

      const newEtag = response.headers.get("ETag");
      if (newEtag) {
        etagRef.current = newEtag;
      }

      if (!data) {
        throw new Error(`Friend export manifest request failed: ${String(response.status)}`);
      }

      return data as FriendExportManifestResponse;
    },
    staleTime: STALE_TIME_MS,
  });
}

interface FriendExportPageOpts {
  readonly entityType: FriendExportEntityType;
  readonly cursor?: string;
  readonly limit?: number;
  readonly enabled?: boolean;
}

/**
 * Fetch a paginated friend export page with ETag-based conditional caching.
 *
 * Returns raw (encrypted) entities — the consumer decrypts using bucket keys.
 */
export function useFriendExportPage(
  connectionId: FriendConnectionId,
  opts?: FriendExportPageOpts,
): UseQueryResult<FriendExportPageResponse> {
  const client = useRestClient();
  const etagRef = useRef<string | null>(null);
  const entityType = opts?.entityType ?? "member";
  const cursor = opts?.cursor;
  const limit = opts?.limit;

  return useQuery<FriendExportPageResponse>({
    queryKey: ["friend-export-page", connectionId, entityType, cursor, limit],
    queryFn: async () => {
      const { data, response } = await client.GET("/account/friends/{connectionId}/export", {
        params: {
          path: { connectionId },
          query: { entityType, cursor, limit },
          header: { "If-None-Match": etagRef.current ?? undefined },
        },
      });

      const newEtag = response.headers.get("ETag");
      if (newEtag) {
        etagRef.current = newEtag;
      }

      if (!data) {
        throw new Error(`Friend export page request failed: ${String(response.status)}`);
      }

      return data as FriendExportPageResponse;
    },
    staleTime: STALE_TIME_MS,
    enabled: opts?.enabled !== false,
  });
}
