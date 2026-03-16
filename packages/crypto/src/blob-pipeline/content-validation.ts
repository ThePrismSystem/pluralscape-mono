import type { BlobPurpose } from "@pluralscape/types";

/** Error thrown when a blob's content type is not allowed for its purpose. */
export class ContentTypeNotAllowedError extends Error {
  override readonly name = "ContentTypeNotAllowedError" as const;
  readonly mimeType: string;
  readonly purpose: BlobPurpose;

  constructor(mimeType: string, purpose: BlobPurpose) {
    super(`Content type "${mimeType}" is not allowed for purpose "${purpose}".`);
    this.mimeType = mimeType;
    this.purpose = purpose;
  }
}

/** Allowed MIME types per blob purpose. */
const ALLOWED_MIME_TYPES: Readonly<Record<BlobPurpose, readonly string[]>> = {
  avatar: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  "member-photo": ["image/png", "image/jpeg", "image/webp", "image/gif"],
  "journal-image": ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"],
  attachment: [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/svg+xml",
    "application/pdf",
    "text/plain",
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    "video/mp4",
    "video/webm",
  ],
  export: ["application/zip", "application/json"],
  "littles-safe-mode": ["image/png", "image/jpeg", "image/webp", "image/gif"],
};

/** Returns the allowed MIME types for a given blob purpose. */
export function getAllowedMimeTypes(purpose: BlobPurpose): readonly string[] {
  return ALLOWED_MIME_TYPES[purpose];
}

/**
 * Validates that a MIME type is allowed for a given blob purpose.
 * Throws ContentTypeNotAllowedError if not allowed.
 */
export function validateBlobContentType(mimeType: string, purpose: BlobPurpose): void {
  const normalized = mimeType.toLowerCase();
  const allowed = ALLOWED_MIME_TYPES[purpose];
  if (!allowed.includes(normalized)) {
    throw new ContentTypeNotAllowedError(mimeType, purpose);
  }
}
