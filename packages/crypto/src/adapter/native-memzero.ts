import type { NativeMemzero } from "../lifecycle-types.js";

/**
 * Wrap a raw native memzero function into a NativeMemzero interface.
 *
 * This factory keeps packages/crypto free of Expo/RN runtime dependencies.
 * The mobile app provides the native function from the NativeMemzero Expo module.
 */
export function wrapNativeMemzero(fn: (buffer: Uint8Array) => void): NativeMemzero {
  return { memzero: fn };
}
