import { describe, expect, it } from "vitest";

import { deserializeEncryptedBlob, serializeEncryptedBlob } from "../blob-codec.js";
import { AEAD_NONCE_BYTES } from "../constants.js";

import type { EncryptedBlob } from "@pluralscape/types";
import type { BucketId } from "@pluralscape/types";

/** Header size: version(1) + tier(1) + algorithm(1) + keyVersion(4) + hasBucketId(1) */
const HEADER_BYTES = 8;

function makeBucketId(raw: string): BucketId {
  return raw as BucketId;
}

function makeNonce(fill = 0xaa): Uint8Array {
  const nonce = new Uint8Array(AEAD_NONCE_BYTES);
  nonce.fill(fill);
  return nonce;
}

function makeT1Blob(overrides?: Partial<EncryptedBlob>): EncryptedBlob {
  return {
    ciphertext: new Uint8Array([1, 2, 3]),
    nonce: makeNonce(),
    tier: 1,
    algorithm: "xchacha20-poly1305",
    keyVersion: null,
    bucketId: null,
    ...overrides,
  };
}

describe("blob-codec", () => {
  describe("round-trip", () => {
    it("round-trips T1 blob with null keyVersion and null bucketId", () => {
      const blob: EncryptedBlob = {
        ciphertext: new Uint8Array([1, 2, 3, 4, 5]),
        nonce: makeNonce(0x11),
        tier: 1,
        algorithm: "xchacha20-poly1305",
        keyVersion: null,
        bucketId: null,
      };

      const serialized = serializeEncryptedBlob(blob);
      const deserialized = deserializeEncryptedBlob(serialized);

      expect(deserialized.ciphertext).toEqual(blob.ciphertext);
      expect(deserialized.nonce).toEqual(blob.nonce);
      expect(deserialized.tier).toBe(1);
      expect(deserialized.algorithm).toBe("xchacha20-poly1305");
      expect(deserialized.keyVersion).toBeNull();
      expect(deserialized.bucketId).toBeNull();
    });

    it("round-trips T2 blob with keyVersion and bucketId", () => {
      const blob: EncryptedBlob = {
        ciphertext: new Uint8Array([10, 20, 30]),
        nonce: makeNonce(0x22),
        tier: 2,
        algorithm: "xchacha20-poly1305",
        keyVersion: 42,
        bucketId: makeBucketId("bucket-abc-123"),
      };

      const serialized = serializeEncryptedBlob(blob);
      const deserialized = deserializeEncryptedBlob(serialized);

      expect(deserialized.ciphertext).toEqual(blob.ciphertext);
      expect(deserialized.nonce).toEqual(blob.nonce);
      expect(deserialized.tier).toBe(2);
      expect(deserialized.algorithm).toBe("xchacha20-poly1305");
      expect(deserialized.keyVersion).toBe(42);
      expect(deserialized.bucketId).toBe("bucket-abc-123");
    });

    it("round-trips empty ciphertext", () => {
      const blob: EncryptedBlob = {
        ciphertext: new Uint8Array(0),
        nonce: makeNonce(0x33),
        tier: 1,
        algorithm: "xchacha20-poly1305",
        keyVersion: null,
        bucketId: null,
      };

      const serialized = serializeEncryptedBlob(blob);
      const deserialized = deserializeEncryptedBlob(serialized);

      expect(deserialized.ciphertext).toEqual(new Uint8Array(0));
    });

    it("round-trips max keyVersion (0xFFFFFFFE)", () => {
      const blob: EncryptedBlob = {
        ciphertext: new Uint8Array([1]),
        nonce: makeNonce(),
        tier: 1,
        algorithm: "xchacha20-poly1305",
        keyVersion: 0xfffffffe,
        bucketId: null,
      };

      const serialized = serializeEncryptedBlob(blob);
      const deserialized = deserializeEncryptedBlob(serialized);

      expect(deserialized.keyVersion).toBe(0xfffffffe);
    });

    it("round-trips T2 blob with keyVersion 0", () => {
      const blob: EncryptedBlob = {
        ciphertext: new Uint8Array([1]),
        nonce: makeNonce(),
        tier: 2,
        algorithm: "xchacha20-poly1305",
        keyVersion: 0,
        bucketId: makeBucketId("b"),
      };

      const serialized = serializeEncryptedBlob(blob);
      const deserialized = deserializeEncryptedBlob(serialized);

      expect(deserialized.keyVersion).toBe(0);
      expect(deserialized.bucketId).toBe("b");
    });

    it("round-trips large ciphertext", () => {
      const ciphertext = new Uint8Array(100_000);
      ciphertext.fill(0xff);
      const blob: EncryptedBlob = {
        ciphertext,
        nonce: makeNonce(),
        tier: 1,
        algorithm: "xchacha20-poly1305",
        keyVersion: 1,
        bucketId: null,
      };

      const serialized = serializeEncryptedBlob(blob);
      const deserialized = deserializeEncryptedBlob(serialized);

      expect(deserialized.ciphertext).toEqual(ciphertext);
    });

    it("round-trips unicode bucketId", () => {
      const blob: EncryptedBlob = {
        ciphertext: new Uint8Array([1]),
        nonce: makeNonce(),
        tier: 2,
        algorithm: "xchacha20-poly1305",
        keyVersion: 1,
        bucketId: makeBucketId("bucket-日本語-test"),
      };

      const serialized = serializeEncryptedBlob(blob);
      const deserialized = deserializeEncryptedBlob(serialized);

      expect(deserialized.bucketId).toBe("bucket-日本語-test");
    });

    it("round-trips when input is a subarray with non-zero byteOffset", () => {
      const blob = makeT1Blob({ ciphertext: new Uint8Array([7, 8, 9]) });
      const serialized = serializeEncryptedBlob(blob);
      // Embed in a larger buffer at a non-zero offset
      const padded = new Uint8Array(10 + serialized.length + 10);
      padded.set(serialized, 10);
      const subarray = padded.subarray(10, 10 + serialized.length);
      const deserialized = deserializeEncryptedBlob(subarray);
      expect(deserialized.ciphertext).toEqual(blob.ciphertext);
      expect(deserialized.nonce).toEqual(blob.nonce);
    });
  });

  describe("serialize", () => {
    it("produces expected header structure", () => {
      const blob: EncryptedBlob = {
        ciphertext: new Uint8Array([0xca, 0xfe]),
        nonce: makeNonce(0x00),
        tier: 1,
        algorithm: "xchacha20-poly1305",
        keyVersion: null,
        bucketId: null,
      };

      const bytes = serializeEncryptedBlob(blob);
      expect(bytes[0]).toBe(0x01); // version
      expect(bytes[1]).toBe(1); // tier
      expect(bytes[2]).toBe(0); // algorithm (xchacha20-poly1305 = 0)

      // keyVersion: null → 0xFFFFFFFF
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      expect(view.getUint32(3, true)).toBe(0xffffffff);

      expect(bytes[7]).toBe(0); // hasBucketId = 0

      // nonce starts at offset 8
      expect(bytes.slice(8, 8 + AEAD_NONCE_BYTES)).toEqual(makeNonce(0x00));

      // ciphertext starts at offset 8 + 24 = 32
      expect(bytes.slice(32)).toEqual(new Uint8Array([0xca, 0xfe]));
    });

    it("includes bucketId length prefix when present", () => {
      const blob: EncryptedBlob = {
        ciphertext: new Uint8Array([0xab]),
        nonce: makeNonce(0x00),
        tier: 2,
        algorithm: "xchacha20-poly1305",
        keyVersion: 5,
        bucketId: makeBucketId("ab"),
      };

      const bytes = serializeEncryptedBlob(blob);
      expect(bytes[7]).toBe(1); // hasBucketId = 1

      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      expect(view.getUint16(8, true)).toBe(2); // bucketId UTF-8 length = 2

      // "ab" UTF-8 bytes at offset 10
      expect(bytes[10]).toBe(0x61); // 'a'
      expect(bytes[11]).toBe(0x62); // 'b'

      // nonce at offset 12
      expect(bytes.slice(12, 12 + AEAD_NONCE_BYTES)).toEqual(makeNonce(0x00));

      // ciphertext at offset 12 + 24 = 36
      expect(bytes.slice(36)).toEqual(new Uint8Array([0xab]));
    });
  });

  describe("serialize errors", () => {
    it("throws on invalid tier", () => {
      const blob = makeT1Blob({ tier: 3 as 1 | 2 });
      expect(() => serializeEncryptedBlob(blob)).toThrow("tier");
    });

    it("throws on tier 0", () => {
      const blob = makeT1Blob({ tier: 0 as 1 | 2 });
      expect(() => serializeEncryptedBlob(blob)).toThrow("tier");
    });

    it("throws on wrong nonce length (too short)", () => {
      const blob = makeT1Blob({ nonce: new Uint8Array(16) });
      expect(() => serializeEncryptedBlob(blob)).toThrow("nonce length");
    });

    it("throws on wrong nonce length (too long)", () => {
      const blob = makeT1Blob({ nonce: new Uint8Array(32) });
      expect(() => serializeEncryptedBlob(blob)).toThrow("nonce length");
    });

    it("throws on keyVersion equal to null sentinel (0xFFFFFFFF)", () => {
      const blob = makeT1Blob({ keyVersion: 0xffffffff });
      expect(() => serializeEncryptedBlob(blob)).toThrow("reserved");
    });

    it("throws on unknown algorithm", () => {
      const blob = makeT1Blob({
        algorithm: "aes-256-gcm" as "xchacha20-poly1305",
      });
      expect(() => serializeEncryptedBlob(blob)).toThrow("algorithm");
    });
  });

  describe("deserialize errors", () => {
    it("throws on empty buffer", () => {
      expect(() => deserializeEncryptedBlob(new Uint8Array(0))).toThrow("too short");
    });

    it("throws on truncated header (less than minimum)", () => {
      expect(() => deserializeEncryptedBlob(new Uint8Array(5))).toThrow("too short");
    });

    it("throws on unknown version byte", () => {
      const buf = new Uint8Array(32 + AEAD_NONCE_BYTES);
      buf[0] = 0x99; // unknown version
      expect(() => deserializeEncryptedBlob(buf)).toThrow("version");
    });

    it("shows hex in version error message", () => {
      const buf = new Uint8Array(HEADER_BYTES + AEAD_NONCE_BYTES);
      buf[0] = 0x99;
      expect(() => deserializeEncryptedBlob(buf)).toThrow("0x99");
    });

    it("throws on invalid tier", () => {
      const buf = new Uint8Array(32 + AEAD_NONCE_BYTES);
      buf[0] = 0x01;
      buf[1] = 3; // invalid tier
      expect(() => deserializeEncryptedBlob(buf)).toThrow("tier");
    });

    it("throws on invalid algorithm", () => {
      const buf = new Uint8Array(32 + AEAD_NONCE_BYTES);
      buf[0] = 0x01;
      buf[1] = 1;
      buf[2] = 99; // invalid algorithm
      expect(() => deserializeEncryptedBlob(buf)).toThrow("algorithm");
    });

    it("throws on invalid hasBucketId flag", () => {
      const buf = new Uint8Array(HEADER_BYTES + AEAD_NONCE_BYTES);
      buf[0] = 0x01; // version
      buf[1] = 1; // tier
      buf[2] = 0; // algorithm
      const view = new DataView(buf.buffer);
      view.setUint32(3, 0xffffffff, true); // null keyVersion
      buf[7] = 2; // invalid hasBucketId
      expect(() => deserializeEncryptedBlob(buf)).toThrow("hasBucketId");
    });

    it("throws on truncated bucketId", () => {
      const buf = new Uint8Array(10);
      buf[0] = 0x01; // version
      buf[1] = 2; // tier
      buf[2] = 0; // algorithm
      // keyVersion bytes 3-6
      buf[7] = 1; // hasBucketId = 1
      // length at 8-9 says 100 bytes but buffer is only 10 bytes
      const view = new DataView(buf.buffer);
      view.setUint16(8, 100, true);
      expect(() => deserializeEncryptedBlob(buf)).toThrow();
    });

    it("throws on truncated nonce", () => {
      // Header is fine but not enough bytes for the nonce
      const buf = new Uint8Array(8 + 5); // only 5 nonce bytes instead of 24
      buf[0] = 0x01;
      buf[1] = 1;
      buf[2] = 0;
      const view = new DataView(buf.buffer);
      view.setUint32(3, 0xffffffff, true);
      buf[7] = 0;
      expect(() => deserializeEncryptedBlob(buf)).toThrow("nonce");
    });
  });
});
