import { requireNativeModule } from "expo-modules-core";

interface NativeMemzeroModuleType {
  memzero(buffer: Uint8Array): void;
}

/**
 * Native module providing cryptographically secure memory zeroing.
 *
 * iOS: Uses memset_s (C11 Annex K) which is guaranteed not to be optimized away.
 * Android: Uses a volatile-qualified byte-by-byte zeroing loop to prevent
 * dead-store elimination by the JIT/AOT compiler.
 */
export const NativeMemzeroModule = requireNativeModule<NativeMemzeroModuleType>("NativeMemzero");

/** Raw native memzero function suitable for wrapNativeMemzero(). */
export function nativeMemzeroFn(buffer: Uint8Array): void {
  NativeMemzeroModule.memzero(buffer);
}
