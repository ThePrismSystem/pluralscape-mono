import { z } from "zod/v4";

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

/** SHA-256 hex digest length (64 chars). */
const SHA256_HEX_LENGTH = 64;

export const CreateUploadUrlBodySchema = z
  .object({
    purpose: BlobPurposeEnum,
    mimeType: z.string().min(1).max(MAX_MIME_TYPE_LENGTH),
    sizeBytes: z.int().min(1),
    encryptionTier: z.union([z.literal(1), z.literal(2)]),
  })
  .readonly();

export const ConfirmUploadBodySchema = z
  .object({
    checksum: z.string().length(SHA256_HEX_LENGTH),
    thumbnailOfBlobId: z.string().min(1).optional(),
  })
  .readonly();
