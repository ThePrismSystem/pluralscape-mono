import type { BlobId, BucketId, ChecksumHex, SystemId } from "../ids.js";
import type { ServerInternal } from "../server-internal.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived } from "../utility.js";

/** Encryption tier for stored blobs: 1 = at-rest only, 2 = at-rest + per-bucket key. */
export type EncryptionTier = 1 | 2;

/** The intended purpose of a blob. */
export type BlobPurpose =
  | "avatar"
  | "member-photo"
  | "journal-image"
  | "attachment"
  | "export"
  | "littles-safe-mode";

/**
 * Metadata about a stored blob.
 *
 * Intentionally omits AuditMetadata -- blobs are immutable after upload.
 * They are only created or deleted, never updated. Only uploadedAt is tracked.
 */
export interface BlobMetadata {
  readonly id: BlobId;
  readonly systemId: SystemId;
  readonly purpose: BlobPurpose;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksum: ChecksumHex;
  readonly uploadedAt: UnixMillis;
  /** Links this blob as a thumbnail of another blob. Null if not a thumbnail. */
  readonly thumbnailOfBlobId: BlobId | null;
  readonly archived: false;
}

/** An archived blob metadata entry — preserves all data with archive metadata. */
export type ArchivedBlobMetadata = Archived<BlobMetadata>;

/**
 * Server-visible blob metadata — raw Drizzle row shape.
 *
 * Derived from `BlobMetadata` by stripping the domain's `archived: false`
 * literal (the DB carries boolean) and adding the server-only columns the
 * domain doesn't expose: storage wiring (`storageKey`), encryption tier
 * metadata (`encryptionTier`, `bucketId`), and separate `createdAt` /
 * `expiresAt` timestamps alongside the domain's `uploadedAt`.
 *
 * The S3 `storageKey`, `encryptionTier`, `bucketId`, and `expiresAt` fields
 * are branded `ServerInternal<…>` so `Serialize<>` strips them — the client
 * never sees the storage layout. The nullable widening of `mimeType` /
 * `checksum` is kept unbranded: the row exists in a pending state between
 * pre-signed URL issuance and upload completion, but client-facing reads
 * always project these as non-null on confirmed blobs.
 */
export type BlobMetadataServerMetadata = Omit<
  BlobMetadata,
  "archived" | "mimeType" | "checksum" | "uploadedAt"
> & {
  readonly storageKey: ServerInternal<string>;
  readonly mimeType: string | null;
  readonly encryptionTier: ServerInternal<EncryptionTier>;
  readonly bucketId: ServerInternal<BucketId> | null;
  readonly checksum: ChecksumHex | null;
  readonly createdAt: UnixMillis;
  readonly uploadedAt: UnixMillis | null;
  readonly expiresAt: ServerInternal<UnixMillis> | null;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

/**
 * JSON-wire representation of BlobMetadata. Derived from the domain type
 * via `Serialize<T>`; branded IDs become plain strings, `UnixMillis`
 * becomes `number`.
 *
 * NB: Wire is derived from the domain type (not `BlobMetadataServerMetadata`)
 * because the server row widens `mimeType`/`checksum` to nullable (the row
 * exists in a pending state pre-upload) and adds `createdAt`/`expiresAt`/
 * `archived`/`archivedAt` columns the API does not expose. Confirmed
 * blob reads project to the domain shape before serialization.
 */
export type BlobMetadataWire = Serialize<BlobMetadata>;

/** A request to upload a blob. */
export interface BlobUploadRequest {
  readonly purpose: BlobPurpose;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

/** A reference for downloading a blob. */
export interface BlobDownloadRef {
  readonly blobId: BlobId;
  readonly url: string;
  readonly expiresAt: UnixMillis;
}
