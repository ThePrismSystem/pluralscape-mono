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
import type { BlobId } from "@pluralscape/types";

type BlobPage = RouterOutput["blob"]["list"];
type BlobDetail = RouterOutput["blob"]["get"];
type BlobDownloadUrl = RouterOutput["blob"]["getDownloadUrl"];

interface BlobListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function useBlob(blobId: BlobId, opts?: SystemIdOverride): TRPCQuery<BlobDetail> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  return trpc.blob.get.useQuery({ systemId, blobId });
}

export function useBlobsList(opts?: BlobListOpts): TRPCInfiniteQuery<BlobPage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  return trpc.blob.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      getNextPageParam: (lastPage: BlobPage) => lastPage.nextCursor,
    },
  );
}

export function useBlobDownloadUrl(
  blobId: BlobId,
  opts?: SystemIdOverride,
): TRPCQuery<BlobDownloadUrl> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  return trpc.blob.getDownloadUrl.useQuery({ systemId, blobId });
}

export function useDeleteBlob(): TRPCMutation<
  RouterOutput["blob"]["delete"],
  RouterInput["blob"]["delete"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.blob.delete.useMutation({
    onSuccess: (_data, variables) => {
      void utils.blob.get.invalidate({ systemId, blobId: variables.blobId });
      void utils.blob.list.invalidate({ systemId });
    },
  });
}
