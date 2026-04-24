import { z } from "zod/v4";

import { brandedString } from "./branded.js";
import { HexColorSchema, PlaintextImageSourceSchema } from "./plaintext-shared.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

import type { VisualProperties } from "@pluralscape/types";

/**
 * Runtime validator for the shared `VisualProperties` sub-record used by
 * innerworld entities and regions. Mirrors
 * `docs/openapi/schemas/plaintext.yaml#/PlaintextVisualProperties`. The
 * `satisfies` keeps the inferred shape locked to the domain type.
 */
export const VisualPropertiesSchema = z.object({
  color: HexColorSchema.nullable(),
  icon: z.string().nullable(),
  size: z.number().nullable(),
  opacity: z.number().nullable(),
  imageSource: PlaintextImageSourceSchema.nullable(),
  externalUrl: z.string().nullable(),
}) satisfies z.ZodType<VisualProperties>;

/**
 * Pre-encryption input for an innerworld region. Every key here is part
 * of `InnerWorldRegionEncryptedFields`; compile-time parity pins the
 * inferred shape to `Pick<InnerWorldRegion, InnerWorldRegionEncryptedFields>`.
 */
export const InnerWorldRegionEncryptedInputSchema = z
  .object({
    name: z.string(),
    description: z.string().nullable(),
    visual: VisualPropertiesSchema,
    boundaryData: z.array(z.object({ x: z.number(), y: z.number() }).readonly()).readonly(),
    accessType: z.enum(["open", "gatekept"]),
    gatekeeperMemberIds: z.array(brandedString<"MemberId">()).readonly(),
  })
  .readonly();

/**
 * Pre-encryption input for an innerworld entity. Discriminated on
 * `entityType` — each variant carries only the keys it owns. Compile-time
 * parity asserts equality with `DistributivePick<InnerWorldEntity,
 * InnerWorldEntityEncryptedFields>`.
 */
export const InnerWorldEntityEncryptedInputSchema = z.discriminatedUnion("entityType", [
  z
    .object({
      entityType: z.literal("member"),
      positionX: z.number(),
      positionY: z.number(),
      visual: VisualPropertiesSchema,
      linkedMemberId: brandedString<"MemberId">(),
    })
    .readonly(),
  z
    .object({
      entityType: z.literal("landmark"),
      positionX: z.number(),
      positionY: z.number(),
      visual: VisualPropertiesSchema,
      name: z.string(),
      description: z.string().nullable(),
    })
    .readonly(),
  z
    .object({
      entityType: z.literal("structure-entity"),
      positionX: z.number(),
      positionY: z.number(),
      visual: VisualPropertiesSchema,
      linkedStructureEntityId: brandedString<"SystemStructureEntityId">(),
    })
    .readonly(),
]);

/**
 * Pre-encryption input for the innerworld canvas viewport. The domain
 * `systemId` is a route parameter (not part of the encrypted blob) and
 * is intentionally absent.
 */
export const InnerWorldCanvasEncryptedInputSchema = z
  .object({
    viewportX: z.number(),
    viewportY: z.number(),
    zoom: z.number(),
    dimensions: z.object({ width: z.number(), height: z.number() }).readonly(),
  })
  .readonly();

export const CreateRegionBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    parentRegionId: brandedString<"InnerWorldRegionId">().nullable().optional(),
  })
  .readonly();

export const UpdateRegionBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    version: z.int().min(1),
  })
  .readonly();

export const CreateEntityBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    regionId: brandedString<"InnerWorldRegionId">().nullable().optional(),
  })
  .readonly();

export const UpdateEntityBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    version: z.int().min(1),
  })
  .readonly();

export const UpdateCanvasBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    version: z.int().min(1),
  })
  .readonly();
