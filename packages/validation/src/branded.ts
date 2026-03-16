import { z } from "zod/v4";

import type { Brand } from "@pluralscape/types";

/**
 * Zod schema for a branded string type.
 * Uses z.custom to produce the correct Brand<string, B> output type without
 * type assertions — the phantom __brand tag cannot be expressed by z.string().
 * Contract tests in contract.test.ts verify correctness at both compile-time and runtime.
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
