import type { Brand } from "./ids.js";

type AnyBrandedId = Brand<string, string>;

/**
 * Cast a plain string to a branded ID type. Compile-time only — no runtime cost.
 * Centralizes the `as XxxId` pattern so branding changes have one update point.
 *
 * @example
 * ```ts
 * const id = brandId<SystemId>("sys_abc123");
 * ```
 */
export function brandId<B extends AnyBrandedId>(id: B | string): B {
  return id as B;
}
