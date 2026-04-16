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
// wa-sqlite ships global ambient declarations for SQLiteAPI, SQLiteVFS, etc. in
// its index.d.ts, but they are only pulled in when the package is statically
// imported. Since opfs-sqlite-driver.ts uses dynamic imports, we augment the
// module declarations here to give the driver proper types without `any` leakage.

/**
 * Opaque type for the Emscripten WASM module object returned by
 * @journeyapps/wa-sqlite factory functions. Typed as an opaque branded interface
 * to avoid `any` propagation through the strict lint rules.
 */
declare interface WaSqliteModule {
  readonly _brand: unique symbol;
}

/**
 * Minimal SQLite compatible value type mirrored from @journeyapps/wa-sqlite.
 * Defined locally to avoid depending on the package's global ambient declarations
 * which are only resolved when the package is statically imported.
 */
type WaSqliteCompatibleType = number | string | Uint8Array | number[] | bigint | null;

/** Minimal SQLite API surface used by opfs-sqlite-driver.ts. */
declare interface WaSqliteAPI {
  vfs_register(vfs: object, makeDefault?: boolean): number;
  open_v2(zFilename: string, iFlags?: number, zVfs?: string): Promise<number>;
  exec(
    db: number,
    zSQL: string,
    callback?: (row: (WaSqliteCompatibleType | null)[], columns: string[]) => void,
  ): Promise<number>;
  close(db: number): Promise<number>;

  // ── Prepared statement API ──────────────────────────────────────────
  /** Compile SQL into an async iterator of prepared statement handles. */
  statements(db: number, sql: string): AsyncIterable<number>;
  /** Bind an array or object of values to a prepared statement. */
  bind_collection(stmt: number, bindings: ReadonlyArray<WaSqliteCompatibleType | null>): number;
  /** Evaluate one step of a prepared statement. Resolves to SQLITE_ROW or SQLITE_DONE. */
  step(stmt: number): Promise<number>;
  /** Retrieve all column values for the current row (copies blobs). */
  row(stmt: number): (WaSqliteCompatibleType | null)[];
  /** Retrieve all column names for a prepared statement. */
  column_names(stmt: number): string[];
}

/** @journeyapps/wa-sqlite module augmentations. */
declare module "@journeyapps/wa-sqlite/dist/wa-sqlite.mjs" {
  function ModuleFactory(config?: object): Promise<WaSqliteModule>;
  export = ModuleFactory;
}

declare module "@journeyapps/wa-sqlite" {
  export function Factory(Module: WaSqliteModule): WaSqliteAPI;
  /** Return code from step() indicating a row is available. */
  export const SQLITE_ROW: number;
}

/** OPFSCoopSyncVFS instance — the object returned by OPFSCoopSyncVFS.create(). */
declare interface OPFSCoopSyncVFSInstance {
  readonly _opfsBrand: unique symbol;
}

/** OPFSCoopSyncVFS — no upstream TypeScript declarations provided by the package. */
declare module "@journeyapps/wa-sqlite/src/examples/OPFSCoopSyncVFS.js" {
  export const OPFSCoopSyncVFS: {
    create(name: string, module: WaSqliteModule): Promise<OPFSCoopSyncVFSInstance>;
  };
}
