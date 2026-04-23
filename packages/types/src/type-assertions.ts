import { __plaintext } from "./encryption-primitives.js";
import { __brand } from "./ids.js";

/**
 * Structural type equality — returns `true` iff A and B are mutually assignable
 * in *both* directions, accounting for optional-vs-`| undefined`, branded vs
 * unbranded, and variance. Use with `Assert` to create compile-time parity
 * checks.
 */
type EqualFn<T> = <U>() => U extends T ? 1 : 2;

export type Equal<A, B> = EqualFn<A> extends EqualFn<B> ? true : false;

/** Compile-time assertion that `T` is exactly `true`. */
export type Assert<T extends true> = T;

/** One-way subset check. `Extends<A, B>` is `true` iff every `A` is a `B`. */
export type Extends<A, B> = A extends B ? true : false;

/**
 * JSON-serialize transform applied at the type level.
 *
 * Rules (applied recursively):
 * - `Date`                → `string`
 * - `Uint8Array`          → `string` (base64-encoded at runtime)
 * - `Brand<T, _>`         → `T` (brand stripped, since JSON can't carry phantom types)
 * - `Plaintext<T>`        → `Serialize<T>` (plaintext brand stripped; same rationale)
 * - `Map<K, V>`           → `Record<K extends string ? K : string, Serialize<V>>`
 * - `Set<T>`              → `Serialize<T>[]`
 * - arrays                → `Serialize<Element>[]`
 * - objects               → `{ [K in keyof T]: Serialize<T[K]> }` (preserving optional markers)
 * - primitives / null     → unchanged
 *
 * Per-entity hand-authored `<Entity>Wire` is allowed when `Serialize` can't
 * express the transform (e.g. discriminated unions with encryption-shaped
 * variants); CI still enforces `Assert<Equal<components["schemas"]["Entity"],
 * EntityWire>>`.
 */
export type Serialize<T> = T extends Date
  ? string
  : T extends Uint8Array
    ? string
    : T extends { readonly [__brand]: unknown }
      ? ExtractPrimitive<T>
      : T extends { readonly [__plaintext]: true }
        ? ExtractPrimitive<T>
        : T extends Map<infer K, infer V>
          ? Record<K extends string ? K : string, Serialize<V>>
          : T extends Set<infer U>
            ? Serialize<U>[]
            : T extends ReadonlyArray<infer U>
              ? Serialize<U>[]
              : T extends object
                ? { [K in keyof T]: Serialize<T[K]> }
                : T;

/** Extract the primitive type from a branded type (e.g., strip the brand marker). */
type ExtractPrimitive<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T;
