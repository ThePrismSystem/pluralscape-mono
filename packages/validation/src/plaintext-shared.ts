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

import { z } from "zod/v4";

import { brandedString } from "./branded.js";

import type { HexColor, ImageSource } from "@pluralscape/types";

/**
 * Runtime validator for `ImageSource` — a discriminated union on `kind`
 * (`"blob"` → references a stored blob via branded `BlobId`; `"external"`
 * → a remote URL).
 */
export const PlaintextImageSourceSchema: z.ZodType<ImageSource> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("blob"), blobRef: brandedString<"BlobId">() }),
  z.object({ kind: z.literal("external"), url: z.url() }),
]);

export const PlaintextSaturationLevelSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("known"),
    level: z.enum(["fragment", "functional-fragment", "partially-elaborated", "highly-elaborated"]),
  }),
  z.object({ kind: z.literal("custom"), value: z.string() }),
]);

export const PlaintextTagSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("known"),
    tag: z.enum([
      "protector",
      "gatekeeper",
      "caretaker",
      "little",
      "age-slider",
      "trauma-holder",
      "host",
      "persecutor",
      "mediator",
      "anp",
      "memory-holder",
      "symptom-holder",
      "middle",
      "introject",
      "fictive",
      "factive",
      "non-human",
    ]),
  }),
  z.object({ kind: z.literal("custom"), value: z.string() }),
]);

/**
 * Zod schema for a 6-digit hex color string (e.g. `#FF00AA`). Returns the
 * value branded as {@link HexColor}.
 */
export const HexColorSchema: z.ZodType<HexColor> = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a 6-digit hex color starting with #")
  .transform((v): HexColor => v as HexColor);
