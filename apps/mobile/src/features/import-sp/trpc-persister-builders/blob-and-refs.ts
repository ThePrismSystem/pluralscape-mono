import { AVATAR_ENCRYPTION_TIER } from "../import-sp-mobile.constants.js";

import type { PersisterApi } from "../persister/persister.types.js";
import type { FetchFn, TRPCClientSubset } from "../trpc-persister-api.types.js";

type BlobAndRefsClientSlice = Pick<TRPCClientSubset, "blob" | "importEntityRef">;

type BlobAndRefsSection = Pick<PersisterApi, "blob" | "importEntityRef">;

/**
 * SHA-256 hex digest. Copies `bytes` into a fresh `ArrayBuffer` because the TS
 * lib types `Uint8Array.buffer` as `ArrayBufferLike` (includes
 * `SharedArrayBuffer`), which is incompatible with `SubtleCrypto`'s
 * `BufferSource` parameter.
 */
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  const arr = new Uint8Array(digest);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function buildBlobAndRefsSection(
  client: BlobAndRefsClientSlice,
  doFetch: FetchFn,
): BlobAndRefsSection {
  return {
    blob: {
      uploadAvatar: async (
        sysId,
        input: { readonly bytes: Uint8Array; readonly contentType: string },
      ) => {
        const { blobId, uploadUrl } = await client.blob.createUploadUrl.mutate({
          systemId: sysId,
          purpose: "avatar",
          mimeType: input.contentType,
          sizeBytes: input.bytes.length,
          encryptionTier: AVATAR_ENCRYPTION_TIER,
        });

        const response = await doFetch(uploadUrl, {
          method: "PUT",
          body: input.bytes,
          headers: { "Content-Type": input.contentType },
        });
        if (!response.ok) {
          throw new Error(`S3 upload failed with status ${String(response.status)}`);
        }

        const checksum = await sha256Hex(input.bytes);

        await client.blob.confirmUpload.mutate({
          systemId: sysId,
          blobId,
          checksum,
        });

        return { blobId };
      },
    },

    importEntityRef: {
      lookupBatch: async (sysId, input) => {
        if (input.refs.length === 0) {
          return {};
        }

        const grouped = new Map<string, string[]>();
        for (const ref of input.refs) {
          const existing = grouped.get(ref.sourceEntityType);
          if (existing) {
            existing.push(ref.sourceEntityId);
          } else {
            grouped.set(ref.sourceEntityType, [ref.sourceEntityId]);
          }
        }

        const merged: Record<string, string> = {};
        for (const [sourceEntityType, sourceEntityIds] of grouped) {
          const result = await client.importEntityRef.lookupBatch.mutate({
            systemId: sysId,
            source: input.source,
            sourceEntityType,
            sourceEntityIds,
          });
          Object.assign(merged, result);
        }

        return merged;
      },

      upsertBatch: async (sysId, input) => {
        if (input.refs.length === 0) {
          return { upserted: 0 };
        }

        return client.importEntityRef.upsertBatch.mutate({
          systemId: sysId,
          source: input.source,
          entries: input.refs.map((ref) => ({
            sourceEntityType: ref.sourceEntityType,
            sourceEntityId: ref.sourceEntityId,
            pluralscapeEntityId: ref.pluralscapeEntityId,
          })),
        });
      },
    },
  };
}
