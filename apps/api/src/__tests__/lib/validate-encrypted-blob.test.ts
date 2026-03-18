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

describe("validateEncryptedBlob", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns EncryptedBlob for valid base64 data", async () => {
    const fakeBlob = { type: 1, ciphertext: new Uint8Array([1, 2, 3]) } as never as EncryptedBlob;

    const { deserializeEncryptedBlob } = await import("@pluralscape/crypto");
    vi.mocked(deserializeEncryptedBlob).mockReturnValue(fakeBlob);

    const { validateEncryptedBlob } = await import("../../lib/validate-encrypted-blob.js");

    const smallPayload = Buffer.from("hello").toString("base64");
    const result = validateEncryptedBlob(smallPayload);

    expect(result).toBe(fakeBlob);
    expect(deserializeEncryptedBlob).toHaveBeenCalledOnce();
  });

  it("throws 400 BLOB_TOO_LARGE for data exceeding MAX_ENCRYPTED_DATA_BYTES", async () => {
    const { validateEncryptedBlob } = await import("../../lib/validate-encrypted-blob.js");

    const oversizedData = Buffer.alloc(MAX_ENCRYPTED_DATA_BYTES + 1, 0x41);
    const base64 = oversizedData.toString("base64");

    const err = (() => {
      try {
        validateEncryptedBlob(base64);
      } catch (e: unknown) {
        return e;
      }
      return null;
    })();

    expect(err).toBeInstanceOf(ApiHttpError);
    expect(err).toMatchObject({ status: 400, code: "BLOB_TOO_LARGE" });
  });

  it("throws 400 VALIDATION_ERROR for invalid deserialization", async () => {
    const { InvalidInputError } = await import("@pluralscape/crypto");
    const { deserializeEncryptedBlob } = await import("@pluralscape/crypto");
    vi.mocked(deserializeEncryptedBlob).mockImplementation(() => {
      throw new InvalidInputError("bad envelope");
    });

    const { validateEncryptedBlob } = await import("../../lib/validate-encrypted-blob.js");

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

  it("re-throws non-InvalidInputError errors", async () => {
    const { deserializeEncryptedBlob } = await import("@pluralscape/crypto");
    vi.mocked(deserializeEncryptedBlob).mockImplementation(() => {
      throw new TypeError("unexpected");
    });

    const { validateEncryptedBlob } = await import("../../lib/validate-encrypted-blob.js");

    const smallPayload = Buffer.from("hello").toString("base64");

    expect(() => validateEncryptedBlob(smallPayload)).toThrow(TypeError);
  });
});
