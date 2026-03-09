/**
 * Global ambient type declarations for the Pluralscape monorepo.
 *
 * The base tsconfig uses `lib: ["ES2022"]` without DOM, so the global `crypto`
 * object is not declared. This ambient declaration provides the subset we use
 * (randomUUID) so it works in Node 19+, Bun, and React Native (expo-crypto).
 *
 * When a package adds `@types/node` or `lib: ["DOM"]` to its own tsconfig,
 * this declaration merges safely via interface augmentation.
 *
 * Remove this file once the minimum lib target includes `crypto.randomUUID()`.
 */

/** Web Crypto API — available in Node 19+, Bun, and React Native (expo-crypto). */
declare const crypto: {
  randomUUID(): `${string}-${string}-${string}-${string}-${string}`;
};
