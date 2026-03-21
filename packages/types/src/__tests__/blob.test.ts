import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  ArchivedBlobMetadata,
  BlobDownloadRef,
  BlobMetadata,
  BlobPurpose,
  BlobUploadRequest,
  EncryptionTier,
} from "../blob.js";
import type { BlobId, ChecksumHex, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";

describe("BlobPurpose", () => {
  it("accepts valid purposes", () => {
    assertType<BlobPurpose>("avatar");
    assertType<BlobPurpose>("member-photo");
    assertType<BlobPurpose>("journal-image");
    assertType<BlobPurpose>("attachment");
    assertType<BlobPurpose>("export");
  });

  it("rejects invalid purposes", () => {
    // @ts-expect-error invalid purpose
    assertType<BlobPurpose>("video");
  });

  it("is exhaustive in a switch", () => {
    function handlePurpose(purpose: BlobPurpose): string {
      switch (purpose) {
        case "avatar":
        case "member-photo":
        case "journal-image":
        case "attachment":
        case "export":
        case "littles-safe-mode":
          return purpose;
        default: {
          const _exhaustive: never = purpose;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handlePurpose).toBeFunction();
  });
});

describe("EncryptionTier", () => {
  it("accepts valid tiers", () => {
    assertType<EncryptionTier>(1);
    assertType<EncryptionTier>(2);
  });

  it("rejects invalid tiers", () => {
    // @ts-expect-error 0 is not a valid encryption tier
    assertType<EncryptionTier>(0);
    // @ts-expect-error 3 is not a valid encryption tier
    assertType<EncryptionTier>(3);
  });
});

describe("BlobMetadata", () => {
  it("has correct field types", () => {
    expectTypeOf<BlobMetadata["id"]>().toEqualTypeOf<BlobId>();
    expectTypeOf<BlobMetadata["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<BlobMetadata["purpose"]>().toEqualTypeOf<BlobPurpose>();
    expectTypeOf<BlobMetadata["mimeType"]>().toBeString();
    expectTypeOf<BlobMetadata["sizeBytes"]>().toEqualTypeOf<number>();
    expectTypeOf<BlobMetadata["checksum"]>().toEqualTypeOf<ChecksumHex>();
    expectTypeOf<BlobMetadata["uploadedAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<BlobMetadata["thumbnailOfBlobId"]>().toEqualTypeOf<BlobId | null>();
  });

  it("has archived as false literal", () => {
    expectTypeOf<BlobMetadata["archived"]>().toEqualTypeOf<false>();
  });
});

describe("ArchivedBlobMetadata", () => {
  it("has archived as true literal", () => {
    expectTypeOf<ArchivedBlobMetadata["archived"]>().toEqualTypeOf<true>();
  });

  it("has archivedAt timestamp", () => {
    expectTypeOf<ArchivedBlobMetadata["archivedAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("preserves BlobMetadata fields", () => {
    expectTypeOf<ArchivedBlobMetadata["id"]>().toEqualTypeOf<BlobId>();
    expectTypeOf<ArchivedBlobMetadata["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<ArchivedBlobMetadata["purpose"]>().toEqualTypeOf<BlobPurpose>();
  });
});

describe("BlobUploadRequest", () => {
  it("has correct field types", () => {
    expectTypeOf<BlobUploadRequest["purpose"]>().toEqualTypeOf<BlobPurpose>();
    expectTypeOf<BlobUploadRequest["mimeType"]>().toBeString();
    expectTypeOf<BlobUploadRequest["sizeBytes"]>().toEqualTypeOf<number>();
  });
});

describe("BlobDownloadRef", () => {
  it("has correct field types", () => {
    expectTypeOf<BlobDownloadRef["blobId"]>().toEqualTypeOf<BlobId>();
    expectTypeOf<BlobDownloadRef["url"]>().toBeString();
    expectTypeOf<BlobDownloadRef["expiresAt"]>().toEqualTypeOf<UnixMillis>();
  });
});
