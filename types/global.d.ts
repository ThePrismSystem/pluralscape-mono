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

/** TextEncoder/TextDecoder — available in Node 11+, Bun, and React Native. */
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}

declare class TextDecoder {
  decode(input?: BufferSource): string;
}

// ── @journeyapps/wa-sqlite type augmentations ──────────────────────────────────
//
// The package ships ambient declarations for `SQLiteAPI`, `SQLiteVFS`, and
// `SQLiteCompatibleType` via its own `types/index.d.ts`. Those are the source
// of truth for the driver. The only gap we augment here is `OPFSCoopSyncVFS`,
// which is an example module the package does not declare types for.

/** OPFSCoopSyncVFS — no upstream TypeScript declarations provided by the package. */
declare module "@journeyapps/wa-sqlite/src/examples/OPFSCoopSyncVFS.js" {
  export const OPFSCoopSyncVFS: {
    create(name: string, module: unknown): Promise<SQLiteVFS>;
  };
}
