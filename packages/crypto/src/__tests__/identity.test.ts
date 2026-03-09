import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../adapter/wasm-adapter.js";
import {
  BOX_PUBLIC_KEY_BYTES,
  BOX_SECRET_KEY_BYTES,
  SIGN_PUBLIC_KEY_BYTES,
  SIGN_SECRET_KEY_BYTES,
} from "../constants.js";
import { DecryptionFailedError } from "../errors.js";
import {
  decryptPrivateKey,
  encryptPrivateKey,
  generateIdentityKeypair,
  serializePublicKey,
} from "../identity.js";
import { deriveMasterKey, generateSalt } from "../master-key.js";
import { _resetForTesting, configureSodium, initSodium } from "../sodium.js";

import type { SodiumAdapter } from "../adapter/interface.js";
import type { KdfMasterKey } from "../types.js";

let adapter: SodiumAdapter;
let masterKey: KdfMasterKey;
let masterKey2: KdfMasterKey;

beforeAll(async () => {
  _resetForTesting();
  adapter = new WasmSodiumAdapter();
  configureSodium(adapter);
  await initSodium();

  const salt = generateSalt();
  masterKey = await deriveMasterKey("test-password", salt, "mobile");
  masterKey2 = await deriveMasterKey("different-password", salt, "mobile");
});

afterAll(() => {
  _resetForTesting();
});

describe("generateIdentityKeypair", () => {
  it("generates both X25519 and Ed25519 keypairs", () => {
    const identity = generateIdentityKeypair(masterKey);
    expect(identity.encryption).toBeDefined();
    expect(identity.encryption.publicKey).toBeDefined();
    expect(identity.encryption.secretKey).toBeDefined();
    expect(identity.signing).toBeDefined();
    expect(identity.signing.publicKey).toBeDefined();
    expect(identity.signing.secretKey).toBeDefined();
  });

  it("is deterministic — same master key = same keypairs", () => {
    const id1 = generateIdentityKeypair(masterKey);
    const id2 = generateIdentityKeypair(masterKey);

    expect(id1.encryption.publicKey).toEqual(id2.encryption.publicKey);
    expect(id1.encryption.secretKey).toEqual(id2.encryption.secretKey);
    expect(id1.signing.publicKey).toEqual(id2.signing.publicKey);
    expect(id1.signing.secretKey).toEqual(id2.signing.secretKey);
  });

  it("different master keys = different keypairs", () => {
    const id1 = generateIdentityKeypair(masterKey);
    const id2 = generateIdentityKeypair(masterKey2);

    expect(id1.encryption.publicKey).not.toEqual(id2.encryption.publicKey);
    expect(id1.signing.publicKey).not.toEqual(id2.signing.publicKey);
  });

  it("encryption keypair has correct sizes (pub: 32, sec: 32)", () => {
    const identity = generateIdentityKeypair(masterKey);
    expect(identity.encryption.publicKey.length).toBe(BOX_PUBLIC_KEY_BYTES);
    expect(identity.encryption.secretKey.length).toBe(BOX_SECRET_KEY_BYTES);
  });

  it("signing keypair has correct sizes (pub: 32, sec: 64)", () => {
    const identity = generateIdentityKeypair(masterKey);
    expect(identity.signing.publicKey.length).toBe(SIGN_PUBLIC_KEY_BYTES);
    expect(identity.signing.secretKey.length).toBe(SIGN_SECRET_KEY_BYTES);
  });

  it("generated encryption keypair works for box operations", () => {
    const id1 = generateIdentityKeypair(masterKey);
    const id2 = generateIdentityKeypair(masterKey2);

    const nonce = adapter.randomBytes(24);
    const plaintext = new TextEncoder().encode("hello from id1");

    const ciphertext = adapter.boxEasy(
      plaintext,
      nonce as import("../types.js").BoxNonce,
      id2.encryption.publicKey,
      id1.encryption.secretKey,
    );
    const decrypted = adapter.boxOpenEasy(
      ciphertext,
      nonce as import("../types.js").BoxNonce,
      id1.encryption.publicKey,
      id2.encryption.secretKey,
    );

    expect(new TextDecoder().decode(decrypted)).toBe("hello from id1");
  });

  it("generated signing keypair works for sign/verify", () => {
    const identity = generateIdentityKeypair(masterKey);
    const message = new TextEncoder().encode("sign this message");

    const signature = adapter.signDetached(message, identity.signing.secretKey);
    const valid = adapter.signVerifyDetached(signature, message, identity.signing.publicKey);

    expect(valid).toBe(true);
  });
});

describe("encryptPrivateKey/decryptPrivateKey", () => {
  it("roundtrips encryption private key", () => {
    const identity = generateIdentityKeypair(masterKey);
    const encrypted = encryptPrivateKey(identity.encryption.secretKey, masterKey);
    const decrypted = decryptPrivateKey(encrypted, masterKey);
    expect(decrypted).toEqual(identity.encryption.secretKey);
  });

  it("roundtrips signing private key", () => {
    const identity = generateIdentityKeypair(masterKey);
    const encrypted = encryptPrivateKey(identity.signing.secretKey, masterKey);
    const decrypted = decryptPrivateKey(encrypted, masterKey);
    expect(decrypted).toEqual(identity.signing.secretKey);
  });

  it("wrong master key fails decryption", () => {
    const identity = generateIdentityKeypair(masterKey);
    const encrypted = encryptPrivateKey(identity.encryption.secretKey, masterKey);
    expect(() => decryptPrivateKey(encrypted, masterKey2)).toThrow(DecryptionFailedError);
  });
});

describe("serializePublicKey", () => {
  it("produces valid base64url string", () => {
    const identity = generateIdentityKeypair(masterKey);
    const serialized = serializePublicKey(identity.encryption.publicKey);

    expect(typeof serialized).toBe("string");
    expect(serialized.length).toBeGreaterThan(0);
    // base64url: no +, /, or = characters
    expect(serialized).not.toMatch(/[+/=]/);
    // Should be valid base64url
    expect(serialized).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("serializes signing public key", () => {
    const identity = generateIdentityKeypair(masterKey);
    const serialized = serializePublicKey(identity.signing.publicKey);

    expect(typeof serialized).toBe("string");
    expect(serialized).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
