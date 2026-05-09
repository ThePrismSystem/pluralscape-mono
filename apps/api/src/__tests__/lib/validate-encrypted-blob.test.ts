import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../lib/api-error.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";

import type { EncryptedBlob } from "@pluralscape/types";

vi.mock("@pluralscape/crypto", () => {
  return {
    deserializeEncryptedBlob: vi.fn(),
    InvalidInputError: class InvalidInputError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "InvalidInputError";
      }
    },
  };
});

// Single top-level import after mocks are in place.
const { deserializeEncryptedBlob, InvalidInputError } = await import("@pluralscape/crypto");
const { validateEncryptedBlob } = await import("../../lib/encrypted-blob.js");

describe("validateEncryptedBlob", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns EncryptedBlob for valid base64 data", () => {
    // Build a structurally-complete T1EncryptedBlob literal — direct
    // assignment to the discriminated union, no cast required.
    const fakeBlob: EncryptedBlob = {
      tier: 1,
      ciphertext: new Uint8Array([1, 2, 3]),
      nonce: new Uint8Array(24),
      algorithm: "xchacha20-poly1305",
      keyVersion: null,
      bucketId: null,
    };
    vi.mocked(deserializeEncryptedBlob).mockReturnValue(fakeBlob);

    const smallPayload = Buffer.from("hello").toString("base64");
    const result = validateEncryptedBlob(smallPayload);

    expect(result).toBe(fakeBlob);
    expect(deserializeEncryptedBlob).toHaveBeenCalledOnce();
  });

  it("throws 400 BLOB_TOO_LARGE for data exceeding MAX_ENCRYPTED_DATA_BYTES", () => {
    const oversizedData = Buffer.alloc(MAX_ENCRYPTED_DATA_BYTES + 1, 0x41);
    const base64 = oversizedData.toString("base64");

    expect(() => validateEncryptedBlob(base64)).toThrow(
      expect.objectContaining({ status: 400, code: "BLOB_TOO_LARGE" }),
    );
  });

  it("throws 400 VALIDATION_ERROR for invalid deserialization", () => {
    vi.mocked(deserializeEncryptedBlob).mockImplementation(() => {
      throw new InvalidInputError("bad envelope");
    });

    const smallPayload = Buffer.from("hello").toString("base64");

    const err = (() => {
      try {
        validateEncryptedBlob(smallPayload);
      } catch (e: unknown) {
        return e;
      }
      return null;
    })();

    expect(err).toBeInstanceOf(ApiHttpError);
    expect(err).toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
    expect((err as ApiHttpError).message).toContain("bad envelope");
  });

  it("re-throws non-InvalidInputError errors", () => {
    vi.mocked(deserializeEncryptedBlob).mockImplementation(() => {
      throw new TypeError("unexpected");
    });

    const smallPayload = Buffer.from("hello").toString("base64");

    expect(() => validateEncryptedBlob(smallPayload)).toThrow(TypeError);
  });
});
