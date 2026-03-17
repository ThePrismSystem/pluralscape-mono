import { AEAD_NONCE_BYTES, AEAD_TAG_BYTES } from "@pluralscape/crypto";
import { describe, expect, it } from "vitest";

import {
  deserializeEncryptedPayload,
  serializeEncryptedPayload,
} from "../../lib/encrypted-payload.js";

const MIN_PAYLOAD_BYTES = AEAD_NONCE_BYTES + AEAD_TAG_BYTES;

describe("encrypted-payload", () => {
  describe("roundtrip", () => {
    it("serializes and deserializes back to the original nonce and ciphertext", () => {
      const nonce = new Uint8Array(AEAD_NONCE_BYTES).fill(0xaa);
      const ciphertext = new Uint8Array(48).fill(0xbb);

      const serialized = serializeEncryptedPayload({ nonce, ciphertext });
      const result = deserializeEncryptedPayload(serialized);

      expect(result.nonce).toEqual(nonce);
      expect(result.ciphertext).toEqual(ciphertext);
    });

    it("handles minimum-valid-size payload (nonce + tag only)", () => {
      const nonce = new Uint8Array(AEAD_NONCE_BYTES).fill(0x01);
      const ciphertext = new Uint8Array(AEAD_TAG_BYTES).fill(0x02);

      const serialized = serializeEncryptedPayload({ nonce, ciphertext });
      expect(serialized.length).toBe(MIN_PAYLOAD_BYTES);

      const result = deserializeEncryptedPayload(serialized);
      expect(result.nonce).toEqual(nonce);
      expect(result.ciphertext).toEqual(ciphertext);
    });
  });

  describe("deserializeEncryptedPayload length guard", () => {
    it("throws on empty input", () => {
      expect(() => deserializeEncryptedPayload(new Uint8Array(0))).toThrow(
        /Encrypted payload too short/,
      );
    });

    it("throws on input shorter than nonce + tag", () => {
      const tooShort = new Uint8Array(MIN_PAYLOAD_BYTES - 1);
      expect(() => deserializeEncryptedPayload(tooShort)).toThrow(/Encrypted payload too short/);
    });

    it("includes expected and actual byte counts in error message", () => {
      const tooShort = new Uint8Array(5);
      expect(() => deserializeEncryptedPayload(tooShort)).toThrow(
        `Encrypted payload too short: expected at least ${String(MIN_PAYLOAD_BYTES)} bytes, got 5`,
      );
    });
  });

  describe("nonce/ciphertext split correctness", () => {
    it("splits at exactly AEAD_NONCE_BYTES boundary", () => {
      const bytes = new Uint8Array(MIN_PAYLOAD_BYTES + 10);
      // Fill nonce region with 0x11, ciphertext region with 0x22
      bytes.fill(0x11, 0, AEAD_NONCE_BYTES);
      bytes.fill(0x22, AEAD_NONCE_BYTES);

      const result = deserializeEncryptedPayload(bytes);

      expect(result.nonce.length).toBe(AEAD_NONCE_BYTES);
      expect(result.nonce.every((b: number) => b === 0x11)).toBe(true);
      expect(result.ciphertext.length).toBe(AEAD_TAG_BYTES + 10);
      expect(result.ciphertext.every((b: number) => b === 0x22)).toBe(true);
    });
  });
});
