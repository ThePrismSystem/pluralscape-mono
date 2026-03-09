import { assertType, describe, expectTypeOf, it } from "vitest";

import type { BlobDownloadRef, BlobMetadata, BlobPurpose, BlobUploadRequest } from "../blob.js";
import type { BlobId, SystemId } from "../ids.js";
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

describe("BlobMetadata", () => {
  it("has correct field types", () => {
    expectTypeOf<BlobMetadata["id"]>().toEqualTypeOf<BlobId>();
    expectTypeOf<BlobMetadata["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<BlobMetadata["purpose"]>().toEqualTypeOf<BlobPurpose>();
    expectTypeOf<BlobMetadata["mimeType"]>().toBeString();
    expectTypeOf<BlobMetadata["sizeBytes"]>().toEqualTypeOf<number>();
    expectTypeOf<BlobMetadata["checksum"]>().toBeString();
    expectTypeOf<BlobMetadata["uploadedAt"]>().toEqualTypeOf<UnixMillis>();
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
