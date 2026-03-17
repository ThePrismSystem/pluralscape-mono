import { HEX_BYTE_WIDTH, HEX_RADIX } from "./hex.constants.js";

/** Converts a byte array to a lowercase hex string. */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, "0"))
    .join("");
}
