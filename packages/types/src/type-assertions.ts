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
