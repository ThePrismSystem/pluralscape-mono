/**
 * Shared helpers for Drizzle ↔ type-package parity tests.
 *
 * Parity checks compare the row shape inferred from a Drizzle table against
 * the corresponding `*ServerMetadata` interface in @pluralscape/types. The
 * type package uses branded primitives (e.g. `SystemId = Brand<string, ...>`)
 * whereas the shared Drizzle column helpers currently return unbranded
 * primitives. Until brands are lifted into the column helpers (tracked as
 * follow-up `db-drq1`), brand-stripped equality still catches every real
 * drift — new/removed column, changed nullability, changed primitive type.
 *
 * This helper is consumed by multiple `*.type.test.ts` files under this
 * directory; keep it minimal (one recursive type alias).
 */

/** Strip brand markers from primitives and recurse through objects/arrays. */
export type StripBrands<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends bigint
        ? bigint
        : T extends Uint8Array
          ? Uint8Array
          : T extends Date
            ? Date
            : T extends ReadonlyArray<infer U>
              ? StripBrands<U>[]
              : T extends object
                ? { -readonly [K in keyof T]: StripBrands<T[K]> }
                : T;
