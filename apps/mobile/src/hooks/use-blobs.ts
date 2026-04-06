import { trpc } from "@pluralscape/api-client/trpc";
import { getSodium } from "@pluralscape/crypto";
import { useCallback, useRef, useState } from "react";

import { useActiveSystemId } from "../providers/system-provider.js";

import { useDomainMutation } from "./factories.js";
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

/** Presigned URL TTL is server-controlled; keep cache short to avoid serving expired URLs. */
const BLOB_URL_GC_TIME_MS = 5 * 60 * 1_000;

export function useBlobDownloadUrl(
  blobId: BlobId,
  opts?: SystemIdOverride,
): TRPCQuery<BlobDownloadUrl> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  return trpc.blob.getDownloadUrl.useQuery(
    { systemId, blobId },
    { staleTime: BLOB_URL_GC_TIME_MS, gcTime: BLOB_URL_GC_TIME_MS },
  );
}

export function useDeleteBlob(): TRPCMutation<
  RouterOutput["blob"]["delete"],
  RouterInput["blob"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.blob.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.blob.get.invalidate({ systemId, blobId: variables.blobId });
      void utils.blob.list.invalidate({ systemId });
    },
  });
}

// ── useBlobUpload ────────────────────────────────────────────────────

/** Compute BLAKE2b-256 hex digest of a file for upload confirmation. */
async function computeChecksum(file: Blob | ArrayBuffer): Promise<string> {
  const HASH_BYTES = 32;
  const HEX_BASE = 16;
  const PAD_LENGTH = 2;
  const buffer =
    file instanceof Blob ? new Uint8Array(await file.arrayBuffer()) : new Uint8Array(file);
  const hash = getSodium().genericHash(HASH_BYTES, buffer);
  return Array.from(hash, (b) => b.toString(HEX_BASE).padStart(PAD_LENGTH, "0")).join("");
}

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

  // Stable refs for mutation functions (useMutation returns new objects each render)
  const createUrlRef = useRef(createUrlMutation.mutateAsync);
  createUrlRef.current = createUrlMutation.mutateAsync;
  const confirmRef = useRef(confirmMutation.mutateAsync);
  confirmRef.current = confirmMutation.mutateAsync;

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
          const urlResult = await createUrlRef.current({
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

          // Step 3: Compute checksum and confirm upload
          const checksum = await computeChecksum(input.file);

          if (gen !== genRef.current) return;

          const confirmed = await confirmRef.current({
            systemId,
            blobId: urlResult.blobId,
            checksum,
          });

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
    [systemId, utils.blob.list],
  );

  return { upload, status, progress, error, result, reset };
}
