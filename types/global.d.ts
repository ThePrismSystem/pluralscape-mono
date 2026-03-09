/* Global ambient type declarations for the Pluralscape monorepo */

/** Web Crypto API — available in Node 19+, Bun, and React Native (expo-crypto). */
declare const crypto: {
  randomUUID(): `${string}-${string}-${string}-${string}-${string}`;
};
