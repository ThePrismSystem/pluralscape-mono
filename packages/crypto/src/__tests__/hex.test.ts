import { describe, expect, it } from "vitest";

import { InvalidInputError } from "../errors.js";
import { fromHex, toHex } from "../hex.js";

describe("hex module", () => {
  describe("toHex", () => {
    it("encodes empty Uint8Array to empty string", () => {
      expect(toHex(new Uint8Array([]))).toBe("");
    });

    it("encodes single byte", () => {
      expect(toHex(new Uint8Array([0xff]))).toBe("ff");
    });

    it("encodes single zero byte with padding", () => {
      expect(toHex(new Uint8Array([0x00]))).toBe("00");
    });

    it("encodes multiple bytes to lowercase hex", () => {
      expect(toHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe("deadbeef");
    });

    it("pads single-digit values with leading zero", () => {
      expect(toHex(new Uint8Array([0x0a]))).toBe("0a");
    });
  });

  describe("fromHex", () => {
    it("decodes empty string to empty Uint8Array", () => {
      expect(fromHex("")).toEqual(new Uint8Array([]));
    });

    it("decodes single byte hex", () => {
      expect(fromHex("ff")).toEqual(new Uint8Array([0xff]));
    });

    it("decodes multi-byte hex", () => {
      expect(fromHex("deadbeef")).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    });

    it("accepts uppercase hex", () => {
      expect(fromHex("DEADBEEF")).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    });

    it("accepts mixed case hex", () => {
      expect(fromHex("DeAdBeEf")).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    });

    it("throws InvalidInputError for odd-length string", () => {
      expect(() => fromHex("abc")).toThrow(InvalidInputError);
    });

    it("throws InvalidInputError for non-hex characters", () => {
      expect(() => fromHex("zzzz")).toThrow(InvalidInputError);
    });
  });

  describe("round-trip", () => {
    it("round-trips arbitrary bytes", () => {
      const original = new Uint8Array([0, 1, 127, 128, 255]);
      expect(fromHex(toHex(original))).toEqual(original);
    });

    it("round-trips 32-byte key-sized buffer", () => {
      const original = new Uint8Array(32);
      for (let i = 0; i < original.length; i++) {
        original[i] = i * 8;
      }
      expect(fromHex(toHex(original))).toEqual(original);
    });
  });
});
