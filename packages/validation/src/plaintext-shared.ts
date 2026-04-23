/**
 * Shared Zod schemas for plaintext sub-types used across multiple entity
 * encrypted-input schemas. Mirrors
 * `docs/openapi/schemas/plaintext.yaml`'s `PlaintextImageSource`,
 * `PlaintextSaturationLevel`, and `PlaintextTag`.
 *
 * Consumed by per-entity encrypted-input schemas (e.g.
 * `MemberEncryptedInputSchema`). Keeping these centralised prevents drift
 * between entities whose encrypted fields reuse the same primitives.
 */

import { KNOWN_SATURATION_LEVELS, KNOWN_TAGS } from "@pluralscape/types";
import { z } from "zod/v4";

import { brandedString } from "./branded.js";

import type { ImageSource } from "@pluralscape/types";

/** Matches a 6-digit hex color string prefixed with `#` (e.g. `#FF00AA`). */
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Runtime validator for `ImageSource` — a discriminated union on `kind`
 * (`"blob"` → references a stored blob via branded `BlobId`; `"external"`
 * → a remote URL).
 */
export const PlaintextImageSourceSchema: z.ZodType<ImageSource> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("blob"), blobRef: brandedString<"BlobId">() }),
  z.object({ kind: z.literal("external"), url: z.url() }),
]);

// Derive Zod enums from the same `as const` tuples that back the TS unions
// in `@pluralscape/types`. This closes the enum-drift hole: adding a new
// literal to `KNOWN_TAGS` / `KNOWN_SATURATION_LEVELS` automatically expands
// the accepted runtime set, and the compile-time parity test (which infers
// types through Zod) stays in sync.
export const PlaintextSaturationLevelSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("known"),
    level: z.enum(KNOWN_SATURATION_LEVELS),
  }),
  z.object({ kind: z.literal("custom"), value: z.string() }),
]);

export const PlaintextTagSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("known"),
    tag: z.enum(KNOWN_TAGS),
  }),
  z.object({ kind: z.literal("custom"), value: z.string() }),
]);

/**
 * Zod schema for a 6-digit hex color string (e.g. `#FF00AA`). Uses
 * `brandedString<"HexColor">()` to match the `BlobId` idiom above — the
 * phantom brand is carried through without an `as` cast — and layers the
 * hex-format check as a `refine`.
 */
export const HexColorSchema = brandedString<"HexColor">().refine(
  (v) => HEX_COLOR_REGEX.test(v),
  "Must be a 6-digit hex color starting with #",
);
