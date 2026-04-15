import {
  configureSodium,
  createBucketKeyCache,
  generateBucketKey,
  generateIdentityKeypair,
  generateMasterKey,
  initSodium,
} from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { BucketKeyNotFoundError, DocumentKeyResolver } from "../document-key-resolver.js";

import type { BucketKeyCache, KdfMasterKey, SodiumAdapter, SignKeypair } from "@pluralscape/crypto";
import type { BucketId } from "@pluralscape/types";

let sodium: SodiumAdapter;
let masterKey: KdfMasterKey;
let signingKeys: SignKeypair;
let bucketKeyCache: BucketKeyCache;

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  configureSodium(sodium);
  await initSodium();

  masterKey = generateMasterKey();
  const identity = generateIdentityKeypair(masterKey);
  signingKeys = identity.signing;
  bucketKeyCache = createBucketKeyCache();
});

afterAll(() => {
  sodium.memzero(signingKeys.secretKey);
  sodium.memzero(masterKey);
});

describe("DocumentKeyResolver", () => {
  let resolver: DocumentKeyResolver | undefined;

  afterEach(() => {
    resolver?.dispose();
    resolver = undefined;
    bucketKeyCache.clearAll();
  });

  function makeResolver(): DocumentKeyResolver {
    resolver = DocumentKeyResolver.create({
      masterKey,
      signingKeys,
      bucketKeyCache,
      sodium,
    });
    return resolver;
  }

  describe("derived-key documents", () => {
    it("resolves system-core document to derived sync key + signing keys", () => {
      const r = makeResolver();
      const keys = r.resolveKeys("system-core-sys_abc");
      expect(keys.encryptionKey).toBeInstanceOf(Uint8Array);
      expect(keys.encryptionKey.byteLength).toBe(32);
      expect(keys.signingKeys).toBe(signingKeys);
    });

    it("returns same encryption key for all derived-key doc types", () => {
      const r = makeResolver();
      const k1 = r.resolveKeys("system-core-sys_a");
      const k2 = r.resolveKeys("fronting-sys_a");
      const k3 = r.resolveKeys("chat-ch_a");
      const k4 = r.resolveKeys("journal-sys_a");
      const k5 = r.resolveKeys("privacy-config-sys_a");
      expect(k1.encryptionKey).toBe(k2.encryptionKey);
      expect(k2.encryptionKey).toBe(k3.encryptionKey);
      expect(k3.encryptionKey).toBe(k4.encryptionKey);
      expect(k4.encryptionKey).toBe(k5.encryptionKey);
    });

    it("returns consistent keys on repeated calls", () => {
      const r = makeResolver();
      const k1 = r.resolveKeys("system-core-sys_a");
      const k2 = r.resolveKeys("system-core-sys_a");
      expect(k1.encryptionKey).toBe(k2.encryptionKey);
      expect(k1.signingKeys).toBe(k2.signingKeys);
    });
  });

  describe("bucket documents", () => {
    it("resolves bucket document to bucket key from cache", () => {
      const bucketId = "bkt_test" as BucketId;
      const bucketKey = generateBucketKey();
      bucketKeyCache.set(bucketId, bucketKey);

      const r = makeResolver();
      const keys = r.resolveKeys("bucket-bkt_test");
      expect(keys.encryptionKey).toBe(bucketKey);
      expect(keys.signingKeys).toBe(signingKeys);
    });

    it("throws BucketKeyNotFoundError when bucket key not in cache", () => {
      const r = makeResolver();
      expect(() => r.resolveKeys("bucket-bkt_missing")).toThrow(BucketKeyNotFoundError);
    });

    it("BucketKeyNotFoundError has bucketId property", () => {
      const r = makeResolver();
      try {
        r.resolveKeys("bucket-bkt_nope");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(BucketKeyNotFoundError);
        expect((err as BucketKeyNotFoundError).bucketId).toBe("bkt_nope");
      }
    });
  });

  describe("cross-key-type isolation", () => {
    it("derived-key encryption key differs from bucket key", () => {
      const bucketId = "bkt_iso" as BucketId;
      const bucketKey = generateBucketKey();
      bucketKeyCache.set(bucketId, bucketKey);

      const r = makeResolver();
      const derivedKeys = r.resolveKeys("system-core-sys_a");
      const bucketKeys = r.resolveKeys("bucket-bkt_iso");
      expect(derivedKeys.encryptionKey).not.toBe(bucketKeys.encryptionKey);
    });
  });

  describe("dispose", () => {
    it("throws after dispose", () => {
      const r = makeResolver();
      r.dispose();
      expect(() => r.resolveKeys("system-core-sys_a")).toThrow(/disposed/);
      resolver = undefined;
    });

    it("dispose is idempotent", () => {
      const r = makeResolver();
      r.dispose();
      expect(() => {
        r.dispose();
      }).not.toThrow();
      resolver = undefined;
    });

    it("zeroes the cached sync key on dispose", () => {
      const r = makeResolver();
      const keys = r.resolveKeys("system-core-sys_a");
      const keyRef = keys.encryptionKey;
      const copy = new Uint8Array(keyRef);
      expect(copy.some((b: number) => b !== 0)).toBe(true);

      r.dispose();
      expect(keyRef.every((b: number) => b === 0)).toBe(true);
      resolver = undefined;
    });
  });
});
