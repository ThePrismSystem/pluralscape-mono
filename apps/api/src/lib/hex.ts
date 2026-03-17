import { HEX_BYTE_WIDTH, HEX_RADIX } from "./hex.constants.js";

/** Converts a byte array to a lowercase hex string. */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, "0"))
    .join("");
}

/** Decode a hex string to bytes. Throws on invalid hex. */
export function fromHex(hex: string): Uint8Array {
  if (hex.length % HEX_BYTE_WIDTH !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error("Invalid hex string");
  }
  const bytes = new Uint8Array(hex.length / HEX_BYTE_WIDTH);
  for (let i = 0; i < bytes.length; i++) {
    const offset = i * HEX_BYTE_WIDTH;
    bytes[i] = parseInt(hex.slice(offset, offset + HEX_BYTE_WIDTH), HEX_RADIX);
  }
  return bytes;
}
