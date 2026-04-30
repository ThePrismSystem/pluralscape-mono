/** @internal Implementation detail — do not construct branded IDs via this symbol; use `brandId()`. */
export declare const __brand: unique symbol;

/**
 * Branded type — makes `T` nominally distinct via a phantom brand tag.
 * A `Brand<string, 'SystemId'>` is not assignable from a plain `string`
 * or from `Brand<string, 'MemberId'>`.
 */
export type Brand<T, B extends string> = T & { readonly [__brand]: B };
