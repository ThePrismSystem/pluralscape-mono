import { describe, expect, it } from "vitest";

import { mapS3Error } from "../adapters/s3/s3-error-mapper.js";
import {
  BlobAlreadyExistsError,
  BlobNotFoundError,
  BlobTooLargeError,
  StorageBackendError,
} from "../errors.js";

function makeAwsError(name: string, message = "test"): Error {
  const err = new Error(message);
  err.name = name;
  return err;
}

describe("mapS3Error", () => {
  it("maps NoSuchKey to BlobNotFoundError", () => {
    expect(() => mapS3Error(makeAwsError("NoSuchKey"), "sys/blob")).toThrow(BlobNotFoundError);
  });

  it("maps NotFound to BlobNotFoundError", () => {
    expect(() => mapS3Error(makeAwsError("NotFound"), "sys/blob")).toThrow(BlobNotFoundError);
  });

  it("maps EntityTooLarge to BlobTooLargeError", () => {
    expect(() => mapS3Error(makeAwsError("EntityTooLarge"), "sys/blob")).toThrow(BlobTooLargeError);
  });

  it("maps ConditionalCheckFailedException to BlobAlreadyExistsError", () => {
    expect(() => mapS3Error(makeAwsError("ConditionalCheckFailedException"), "sys/blob")).toThrow(
      BlobAlreadyExistsError,
    );
  });

  it("wraps unknown errors in StorageBackendError", () => {
    expect(() => mapS3Error(makeAwsError("InternalError", "boom"), "sys/blob")).toThrow(
      StorageBackendError,
    );
  });

  it("wraps non-Error values in StorageBackendError", () => {
    expect(() => mapS3Error("string-error", "sys/blob")).toThrow(StorageBackendError);
  });

  it("preserves original error as cause", () => {
    const original = makeAwsError("NoSuchKey");
    try {
      mapS3Error(original, "sys/blob");
    } catch (err) {
      expect(err).toBeInstanceOf(BlobNotFoundError);
      expect((err as BlobNotFoundError).cause).toBe(original);
    }
  });
});
