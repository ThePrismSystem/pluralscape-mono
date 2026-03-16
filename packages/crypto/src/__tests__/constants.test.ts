import { describe, expect, it } from "vitest";

import {
  AEAD_KEY_BYTES,
  AEAD_NONCE_BYTES,
  AEAD_TAG_BYTES,
  BOX_MAC_BYTES,
  BOX_NONCE_BYTES,
  BOX_PUBLIC_KEY_BYTES,
  BOX_SECRET_KEY_BYTES,
  BOX_SEED_BYTES,
  KDF_BYTES_MAX,
  KDF_BYTES_MIN,
  KDF_CONTEXT_BYTES,
  KDF_KEY_BYTES,
  PWHASH_MEMLIMIT_INTERACTIVE,
  PWHASH_MEMLIMIT_MODERATE,
  PWHASH_OPSLIMIT_INTERACTIVE,
  PWHASH_OPSLIMIT_MODERATE,
  PWHASH_SALT_BYTES,
  SIGN_BYTES,
  SIGN_PUBLIC_KEY_BYTES,
  SIGN_SECRET_KEY_BYTES,
  SIGN_SEED_BYTES,
  SODIUM_CONSTANTS,
} from "../crypto.constants.js";

describe("AEAD constants", () => {
  it("key is 32 bytes (256-bit)", () => {
    expect(AEAD_KEY_BYTES).toBe(32);
  });

  it("nonce is 24 bytes (192-bit XChaCha20)", () => {
    expect(AEAD_NONCE_BYTES).toBe(24);
  });

  it("tag is 16 bytes (128-bit Poly1305)", () => {
    expect(AEAD_TAG_BYTES).toBe(16);
  });
});

describe("Box constants", () => {
  it("public key is 32 bytes", () => {
    expect(BOX_PUBLIC_KEY_BYTES).toBe(32);
  });

  it("secret key is 32 bytes", () => {
    expect(BOX_SECRET_KEY_BYTES).toBe(32);
  });

  it("nonce is 24 bytes", () => {
    expect(BOX_NONCE_BYTES).toBe(24);
  });

  it("MAC is 16 bytes", () => {
    expect(BOX_MAC_BYTES).toBe(16);
  });

  it("seed is 32 bytes", () => {
    expect(BOX_SEED_BYTES).toBe(32);
  });
});

describe("Sign constants", () => {
  it("public key is 32 bytes", () => {
    expect(SIGN_PUBLIC_KEY_BYTES).toBe(32);
  });

  it("secret key is 64 bytes", () => {
    expect(SIGN_SECRET_KEY_BYTES).toBe(64);
  });

  it("signature is 64 bytes", () => {
    expect(SIGN_BYTES).toBe(64);
  });

  it("seed is 32 bytes", () => {
    expect(SIGN_SEED_BYTES).toBe(32);
  });
});

describe("Pwhash constants", () => {
  it("salt is 16 bytes", () => {
    expect(PWHASH_SALT_BYTES).toBe(16);
  });

  it("interactive ops limit is 2", () => {
    expect(PWHASH_OPSLIMIT_INTERACTIVE).toBe(2);
  });

  it("interactive mem limit is 64 MB", () => {
    expect(PWHASH_MEMLIMIT_INTERACTIVE).toBe(67108864);
  });

  it("moderate ops limit is 3", () => {
    expect(PWHASH_OPSLIMIT_MODERATE).toBe(3);
  });

  it("moderate mem limit is 256 MB", () => {
    expect(PWHASH_MEMLIMIT_MODERATE).toBe(268435456);
  });
});

describe("KDF constants", () => {
  it("key is 32 bytes", () => {
    expect(KDF_KEY_BYTES).toBe(32);
  });

  it("context is 8 bytes", () => {
    expect(KDF_CONTEXT_BYTES).toBe(8);
  });

  it("minimum sub-key is 16 bytes", () => {
    expect(KDF_BYTES_MIN).toBe(16);
  });

  it("maximum sub-key is 64 bytes", () => {
    expect(KDF_BYTES_MAX).toBe(64);
  });
});

describe("SODIUM_CONSTANTS", () => {
  it("is frozen", () => {
    expect(Object.isFrozen(SODIUM_CONSTANTS)).toBe(true);
  });
});
