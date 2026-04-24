/**
 * Drizzle parity check: the blob_metadata row shape inferred from the
 * `blob_metadata` table structurally matches `BlobMetadataServerMetadata`
 * in @pluralscape/types.
 *
 * Blob is a plaintext entity: the DB row carries the domain `BlobMetadata`
 * plus server-only operational columns (`storageKey`, `encryptionTier`,
 * `bucketId`, separate `createdAt`/`expiresAt`) and widens `mimeType` and
 * `checksum` to nullable — the row exists in a pending state between
 * pre-signed URL issuance and upload completion. See `member.type.test.ts`
 * for the general rationale behind the brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { blobMetadata } from "../../schema/pg/blob-metadata.js";

import type { StripBrands } from "./__helpers__.js";
import type { BlobMetadataServerMetadata, Equal } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("BlobMetadata Drizzle parity", () => {
  it("blob_metadata Drizzle row has the same property keys as BlobMetadataServerMetadata", () => {
    type Row = InferSelectModel<typeof blobMetadata>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof BlobMetadataServerMetadata>();
  });

  it("blob_metadata Drizzle row equals BlobMetadataServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof blobMetadata>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<BlobMetadataServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
