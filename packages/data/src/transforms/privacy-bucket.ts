import {
  assertObjectBlob,
  assertStringField,
  decodeAndDecryptT1,
  encryptInput,
  encryptUpdate,
} from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { Archived, PrivacyBucket, UnixMillis } from "@pluralscape/types";

// ── Wire types (derived from domain types) ──────────────────────────

/** Wire shape returned by `privacyBucket.get` — derived from the `PrivacyBucket` domain type. */
export type PrivacyBucketRaw = Omit<PrivacyBucket, keyof BucketEncryptedFields | "archived"> & {
  readonly encryptedData: string;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

/** Shape returned by `privacyBucket.list`. */
export interface PrivacyBucketPage {
  readonly data: readonly PrivacyBucketRaw[];
  readonly nextCursor: string | null;
}

// ── Encrypted payload types ───────────────────────────────────────────

/** The subset of PrivacyBucket fields stored encrypted on the server. */
export interface BucketEncryptedFields {
  readonly name: string;
  readonly description: string | null;
}

// ── Validators ────────────────────────────────────────────────────────

function assertBucketEncryptedFields(raw: unknown): asserts raw is BucketEncryptedFields {
  const obj = assertObjectBlob(raw, "privacy bucket");
  assertStringField(obj, "privacy bucket", "name");
  if (obj["description"] !== null && typeof obj["description"] !== "string") {
    throw new Error("Decrypted privacy bucket blob: description must be string or null");
  }
}

// ── Transforms ────────────────────────────────────────────────────────

/**
 * Decrypt a single privacy bucket API result into a `PrivacyBucket`.
 *
 * The encrypted blob contains: `name`, `description`.
 * All other fields pass through from the wire payload.
 */
export function decryptPrivacyBucket(
  raw: PrivacyBucketRaw,
  masterKey: KdfMasterKey,
): PrivacyBucket | Archived<PrivacyBucket> {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertBucketEncryptedFields(plaintext);

  const base = {
    id: raw.id,
    systemId: raw.systemId,
    name: plaintext.name,
    description: plaintext.description,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived privacyBucket missing archivedAt");
    return { ...base, archived: true as const, archivedAt: raw.archivedAt };
  }
  return { ...base, archived: false as const };
}

/**
 * Decrypt a paginated privacy bucket list result.
 */
export function decryptPrivacyBucketPage(
  raw: PrivacyBucketPage,
  masterKey: KdfMasterKey,
): { data: (PrivacyBucket | Archived<PrivacyBucket>)[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptPrivacyBucket(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

/**
 * Encrypt privacy bucket plaintext fields for a create payload.
 *
 * Returns `{ encryptedData: string }` — pass the spread of this into the
 * `CreateBucketBodySchema`.
 */
export function encryptBucketInput(
  data: BucketEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

/**
 * Encrypt privacy bucket plaintext fields for an update payload.
 *
 * Returns `{ encryptedData: string; version: number }` — pass the spread of
 * this into the `UpdateBucketBodySchema`.
 */
export function encryptBucketUpdate(
  data: BucketEncryptedFields,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
