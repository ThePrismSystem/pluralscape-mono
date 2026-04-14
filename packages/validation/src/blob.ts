import { toChecksumHex } from "@pluralscape/types";
import { z } from "zod/v4";

import type { BlobPurpose } from "@pluralscape/types";

const BlobPurposeEnum = z.enum([
  "avatar",
  "member-photo",
  "journal-image",
  "attachment",
  "export",
  "littles-safe-mode",
]);

/** Maximum length of a MIME type string. */
const MAX_MIME_TYPE_LENGTH = 255;

/** Checksum hex digest length (64 chars). */
const CHECKSUM_HEX_LENGTH = 64;

/** Strict per-purpose MIME type allowlists to prevent stored XSS via arbitrary content types. */
export const ALLOWED_MIME_TYPES: Readonly<Record<BlobPurpose, readonly string[]>> = {
  avatar: ["image/png", "image/jpeg", "image/webp"],
  "member-photo": ["image/png", "image/jpeg", "image/webp"],
  "journal-image": ["image/png", "image/jpeg", "image/webp", "image/gif"],
  attachment: ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"],
  export: ["application/octet-stream"],
  "littles-safe-mode": ["image/png", "image/jpeg", "image/webp"],
};

export const CreateUploadUrlBodySchema = z
  .object({
    purpose: BlobPurposeEnum,
    mimeType: z.string().min(1).max(MAX_MIME_TYPE_LENGTH),
    sizeBytes: z.int().min(1),
    encryptionTier: z.union([z.literal(1), z.literal(2)]),
  })
  .readonly()
  .superRefine((data, ctx) => {
    const allowed = ALLOWED_MIME_TYPES[data.purpose as BlobPurpose];
    if (!allowed.includes(data.mimeType)) {
      ctx.addIssue({
        code: "custom",
        path: ["mimeType"],
        message: `MIME type "${data.mimeType}" is not allowed for purpose "${data.purpose}". Allowed: ${allowed.join(", ")}`,
      });
    }
  });

export const ConfirmUploadBodySchema = z
  .object({
    checksum: z
      .string()
      .length(CHECKSUM_HEX_LENGTH)
      .regex(/^[0-9a-fA-F]+$/)
      .transform(toChecksumHex),
    thumbnailOfBlobId: z.string().min(1).optional(),
  })
  .readonly();
