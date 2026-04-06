import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRef } from "react";

import { useRestClient } from "../providers/rest-client-provider.js";

import type { paths } from "@pluralscape/api-client";
import type { FriendExportEntityType } from "@pluralscape/types";
import type { FriendConnectionId } from "@pluralscape/types";
import type { UseQueryResult } from "@tanstack/react-query";

/** Response type inferred from the OpenAPI spec for the manifest endpoint. */
type ManifestData =
  paths["/account/friends/{connectionId}/export/manifest"]["get"]["responses"]["200"]["content"]["application/json"];

/** Response type inferred from the OpenAPI spec for the export page endpoint. */
type ExportPageData =
  paths["/account/friends/{connectionId}/export"]["get"]["responses"]["200"]["content"]["application/json"];

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
): UseQueryResult<ManifestData | undefined> {
  const client = useRestClient();
  const etagRef = useRef<string | null>(null);

  return useQuery({
    queryKey: ["friend_export_manifest", connectionId] as const,
    queryFn: async (): Promise<ManifestData | undefined> => {
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

      if (response.status === 304) {
        // 304 Not Modified — signal React Query to keep previous data
        return undefined;
      }

      if (!data) {
        throw new Error(`Friend export manifest request failed: ${String(response.status)}`);
      }

      return data;
    },
    staleTime: STALE_TIME_MS,
    placeholderData: keepPreviousData,
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
): UseQueryResult<ExportPageData | undefined> {
  const client = useRestClient();
  const etagRef = useRef<string | null>(null);
  const entityType = opts?.entityType ?? "member";
  const cursor = opts?.cursor;
  const limit = opts?.limit;

  return useQuery({
    queryKey: ["friend_export_page", connectionId, entityType, cursor, limit] as const,
    queryFn: async (): Promise<ExportPageData | undefined> => {
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

      if (response.status === 304) {
        // 304 Not Modified — signal React Query to keep previous data
        return undefined;
      }

      if (!data) {
        throw new Error(`Friend export page request failed: ${String(response.status)}`);
      }

      return data;
    },
    staleTime: STALE_TIME_MS,
    placeholderData: keepPreviousData,
    enabled: opts?.enabled !== false,
  });
}
