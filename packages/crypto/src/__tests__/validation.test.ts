import { describe, expect, it } from "vitest";

import {
  AEAD_KEY_BYTES,
  AEAD_NONCE_BYTES,
  BOX_NONCE_BYTES,
  BOX_PUBLIC_KEY_BYTES,
  BOX_SECRET_KEY_BYTES,
  BOX_SEED_BYTES,
  KDF_BYTES_MAX,
  KDF_BYTES_MIN,
  KDF_CONTEXT_BYTES,
  KDF_KEY_BYTES,
  PWHASH_SALT_BYTES,
  SIGN_BYTES,
  SIGN_PUBLIC_KEY_BYTES,
  SIGN_SECRET_KEY_BYTES,
  SIGN_SEED_BYTES,
} from "../constants.js";
import { InvalidInputError } from "../errors.js";
import {
  assertAeadKey,
  assertAeadNonce,
  assertBoxNonce,
  assertBoxPublicKey,
  assertBoxSecretKey,
  assertBoxSeed,
  assertBufferLength,
  assertKdfContext,
  assertKdfMasterKey,
  assertKdfSubkeyLength,
  assertPwhashSalt,
  assertSignPublicKey,
  assertSignSecretKey,
  assertSignSeed,
  assertSignature,
  validateKeyVersion,
} from "../validation.js";

describe("assertBufferLength", () => {
  it("passes for correct length", () => {
    expect(() => {
      assertBufferLength(new Uint8Array(32), 32, "test");
    }).not.toThrow();
  });

  it("throws InvalidInputError for wrong length", () => {
    expect(() => {
      assertBufferLength(new Uint8Array(16), 32, "test key");
    }).toThrow(InvalidInputError);
  });

  it("includes expected and actual length in message", () => {
    expect(() => {
      assertBufferLength(new Uint8Array(10), 32, "test key");
    }).toThrow(/32 bytes.*10/);
  });
});

describe("buffer length assertions", () => {
  const cases: Array<[string, (buf: Uint8Array) => void, number]> = [
    ["assertAeadKey", assertAeadKey, AEAD_KEY_BYTES],
    ["assertAeadNonce", assertAeadNonce, AEAD_NONCE_BYTES],
    ["assertBoxPublicKey", assertBoxPublicKey, BOX_PUBLIC_KEY_BYTES],
    ["assertBoxSecretKey", assertBoxSecretKey, BOX_SECRET_KEY_BYTES],
    ["assertBoxNonce", assertBoxNonce, BOX_NONCE_BYTES],
    ["assertBoxSeed", assertBoxSeed, BOX_SEED_BYTES],
    ["assertSignPublicKey", assertSignPublicKey, SIGN_PUBLIC_KEY_BYTES],
    ["assertSignSecretKey", assertSignSecretKey, SIGN_SECRET_KEY_BYTES],
    ["assertSignature", assertSignature, SIGN_BYTES],
    ["assertSignSeed", assertSignSeed, SIGN_SEED_BYTES],
    ["assertPwhashSalt", assertPwhashSalt, PWHASH_SALT_BYTES],
    ["assertKdfMasterKey", assertKdfMasterKey, KDF_KEY_BYTES],
  ];

  for (const [name, fn, expected] of cases) {
    it(`${name} passes for ${String(expected)}-byte buffer`, () => {
      expect(() => {
        fn(new Uint8Array(expected));
      }).not.toThrow();
    });

    it(`${name} throws for wrong-size buffer`, () => {
      expect(() => {
        fn(new Uint8Array(expected + 1));
      }).toThrow(InvalidInputError);
    });
  }
});

describe("assertKdfContext", () => {
  it("passes for exactly 8-character context", () => {
    expect(() => {
      assertKdfContext("testctx!");
    }).not.toThrow();
  });

  it("throws for context shorter than 8 chars", () => {
    expect(() => {
      assertKdfContext("short");
    }).toThrow(InvalidInputError);
  });

  it("throws for context longer than 8 chars", () => {
    expect(() => {
      assertKdfContext("toolongctx");
    }).toThrow(InvalidInputError);
  });

  it("includes expected length in error", () => {
    expect(() => {
      assertKdfContext("x");
    }).toThrow(new RegExp(String(KDF_CONTEXT_BYTES)));
  });
});

describe("validateKeyVersion", () => {
  it("accepts positive integers", () => {
    expect(validateKeyVersion(1)).toBe(1);
    expect(validateKeyVersion(42)).toBe(42);
  });

  it("throws InvalidInputError for 0", () => {
    expect(() => validateKeyVersion(0)).toThrow(InvalidInputError);
    expect(() => validateKeyVersion(0)).toThrow(/keyVersion must be a positive safe integer/);
  });

  it("throws InvalidInputError for negative values", () => {
    expect(() => validateKeyVersion(-1)).toThrow(InvalidInputError);
  });

  it("throws InvalidInputError for fractional values", () => {
    expect(() => validateKeyVersion(1.5)).toThrow(InvalidInputError);
  });

  it("throws InvalidInputError for non-safe integers", () => {
    expect(() => validateKeyVersion(Number.MAX_SAFE_INTEGER + 1)).toThrow(InvalidInputError);
  });
});

describe("assertKdfSubkeyLength", () => {
  it("passes for minimum length", () => {
    expect(() => {
      assertKdfSubkeyLength(KDF_BYTES_MIN);
    }).not.toThrow();
  });

  it("passes for maximum length", () => {
    expect(() => {
      assertKdfSubkeyLength(KDF_BYTES_MAX);
    }).not.toThrow();
  });

  it("passes for length between min and max", () => {
    expect(() => {
      assertKdfSubkeyLength(32);
    }).not.toThrow();
  });

  it("throws for length below minimum", () => {
    expect(() => {
      assertKdfSubkeyLength(KDF_BYTES_MIN - 1);
    }).toThrow(InvalidInputError);
  });

  it("throws for length above maximum", () => {
    expect(() => {
      assertKdfSubkeyLength(KDF_BYTES_MAX + 1);
    }).toThrow(InvalidInputError);
  });
});
