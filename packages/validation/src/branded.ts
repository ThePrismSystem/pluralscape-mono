import { z } from "zod/v4";

import type { Brand } from "@pluralscape/types";

/**
 * Generic Zod custom validator for any brand on a non-empty string.
 *
 * For ID brands with a fixed prefix (e.g. `mem_<uuid>`), use
 * {@link brandedIdQueryParam} instead — it enforces the prefix pattern
 * and is the canonical helper for branded IDs from `packages/types/src/ids.ts`.
 *
 * This generic helper exists for non-ID brands (e.g. opaque tags) where
 * only non-emptiness is checked. Callers should prefer the prefix-strict
 * helper when an ID brand is being validated.
 *
 * Uses z.custom to produce the correct Brand<string, B> output type without
 * type assertions — the phantom __brand tag cannot be expressed by z.string().
 * Contract tests in contract.test.ts verify correctness at compile-time and runtime.
 */
export function brandedString<B extends string>(): z.ZodType<Brand<string, B>> {
  return z.custom<Brand<string, B>>((val) => typeof val === "string" && val.length > 0);
}

/**
 * Zod schema for a branded number type.
 */
export function brandedNumber<B extends string>(): z.ZodType<Brand<number, B>> {
  return z.custom<Brand<number, B>>((val) => typeof val === "number" && Number.isFinite(val));
}
