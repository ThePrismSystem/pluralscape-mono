import { trpc } from "@pluralscape/api-client/trpc";
import { useCallback, useRef, useState } from "react";

import { useActiveSystemId } from "../providers/system-provider.js";

import {
  DEFAULT_LIST_LIMIT,
  type SystemIdOverride,
  type TRPCInfiniteQuery,
  type TRPCMutation,
  type TRPCQuery,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type { BlobId, BlobPurpose, EncryptionTier } from "@pluralscape/types";

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

// ── useBlobUpload ────────────────────────────────────────────────────

type BlobUploadStatus =
  | "idle"
  | "requesting-url"
  | "uploading"
  | "confirming"
  | "success"
  | "error";

interface BlobUploadInput {
  readonly purpose: BlobPurpose;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly encryptionTier: EncryptionTier;
  readonly file: Blob | ArrayBuffer;
}

interface BlobUploadState {
  readonly upload: (input: BlobUploadInput) => void;
  readonly status: BlobUploadStatus;
  readonly progress: number;
  readonly error: Error | null;
  readonly result: RouterOutput["blob"]["confirmUpload"] | null;
  readonly reset: () => void;
}

export function useBlobUpload(): BlobUploadState {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();
  const createUrlMutation = trpc.blob.createUploadUrl.useMutation();
  const confirmMutation = trpc.blob.confirmUpload.useMutation();

  const [status, setStatus] = useState<BlobUploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<RouterOutput["blob"]["confirmUpload"] | null>(null);
  // Generation counter: incremented on reset so in-flight uploads can detect staleness
  const genRef = useRef(0);

  const reset = useCallback(() => {
    genRef.current += 1;
    setStatus("idle");
    setProgress(0);
    setError(null);
    setResult(null);
  }, []);

  const upload = useCallback(
    (input: BlobUploadInput) => {
      genRef.current += 1;
      const gen = genRef.current;
      setStatus("requesting-url");
      setProgress(0);
      setError(null);
      setResult(null);

      void (async () => {
        try {
          // Step 1: Get presigned upload URL
          const urlResult = await createUrlMutation.mutateAsync({
            systemId,
            purpose: input.purpose,
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
            encryptionTier: input.encryptionTier,
          });

          if (gen !== genRef.current) return;
          setStatus("uploading");

          // Step 2: PUT file to presigned URL
          const response = await fetch(urlResult.uploadUrl, {
            method: "PUT",
            body: input.file,
            headers: { "Content-Type": input.mimeType },
          });

          if (!response.ok) {
            throw new Error(`Upload failed with status ${String(response.status)}`);
          }

          if (gen !== genRef.current) return;
          setProgress(1);
          setStatus("confirming");

          // Step 3: Confirm upload
          const confirmed = await confirmMutation.mutateAsync({
            systemId,
            blobId: urlResult.blobId,
          } as RouterInput["blob"]["confirmUpload"]);

          if (gen !== genRef.current) return;
          setResult(confirmed);
          setStatus("success");
          void utils.blob.list.invalidate({ systemId });
        } catch (err) {
          if (gen === genRef.current) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setStatus("error");
          }
        }
      })();
    },
    [systemId, createUrlMutation, confirmMutation, utils.blob.list],
  );

  return { upload, status, progress, error, result, reset };
}
