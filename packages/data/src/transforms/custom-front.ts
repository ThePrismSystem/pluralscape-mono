import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { Archived, CustomFront, HexColor, UnixMillis } from "@pluralscape/types";

// ── Wire types (derived from domain types) ──────────────────────────

/** Wire shape returned by `customFront.get` — derived from the `CustomFront` domain type. */
export type CustomFrontRaw = Omit<CustomFront, keyof CustomFrontEncryptedFields | "archived"> & {
  readonly encryptedData: string;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

/** Shape returned by `customFront.list`. */
export interface CustomFrontPage {
  readonly data: readonly CustomFrontRaw[];
  readonly nextCursor: string | null;
}

// ── Encrypted payload types ───────────────────────────────────────────

/**
 * The plaintext fields encrypted inside a custom front blob.
 * Pass this to `encryptCustomFrontInput` when creating a custom front, or
 * `encryptCustomFrontUpdate` when updating one.
 */
export interface CustomFrontEncryptedFields {
  readonly name: string;
  readonly description: string | null;
  readonly color: HexColor | null;
  readonly emoji: string | null;
}

/** Compile-time check: encrypted fields must be a subset of the domain type. */
export type AssertCustomFrontFieldsSubset =
  CustomFrontEncryptedFields extends Pick<CustomFront, keyof CustomFrontEncryptedFields>
    ? true
    : never;

// ── Validators ────────────────────────────────────────────────────────

function assertCustomFrontEncryptedFields(raw: unknown): asserts raw is CustomFrontEncryptedFields {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Decrypted custom front blob is not an object");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj["name"] !== "string") {
    throw new Error("Decrypted custom front blob missing required string field: name");
  }
  if (obj["description"] !== null && typeof obj["description"] !== "string") {
    throw new Error("Decrypted custom front blob: description must be string or null");
  }
  if (obj["color"] !== null && typeof obj["color"] !== "string") {
    throw new Error("Decrypted custom front blob: color must be string or null");
  }
  if (obj["emoji"] !== null && typeof obj["emoji"] !== "string") {
    throw new Error("Decrypted custom front blob: emoji must be string or null");
  }
}

// ── Transforms ────────────────────────────────────────────────────────

/**
 * Decrypt a single custom front API result into a `CustomFront`.
 *
 * The encrypted blob contains: `name`, `description`, `color`, `emoji`.
 * All other fields pass through from the wire payload.
 */
export function decryptCustomFront(
  raw: CustomFrontRaw,
  masterKey: KdfMasterKey,
): CustomFront | Archived<CustomFront> {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertCustomFrontEncryptedFields(plaintext);

  const base = {
    id: raw.id,
    systemId: raw.systemId,
    name: plaintext.name,
    description: plaintext.description,
    color: plaintext.color,
    emoji: plaintext.emoji,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived custom front missing archivedAt");
    return { ...base, archived: true as const, archivedAt: raw.archivedAt };
  }
  return { ...base, archived: false as const };
}

/**
 * Decrypt a paginated custom front list result.
 */
export function decryptCustomFrontPage(
  raw: CustomFrontPage,
  masterKey: KdfMasterKey,
): { data: (CustomFront | Archived<CustomFront>)[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptCustomFront(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

/**
 * Encrypt custom front plaintext fields for a create payload.
 *
 * Returns `{ encryptedData: string }` — pass the spread of this into the
 * `CreateCustomFrontBodySchema`.
 */
export function encryptCustomFrontInput(
  data: CustomFrontEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

/**
 * Encrypt custom front plaintext fields for an update payload.
 *
 * Returns `{ encryptedData: string; version: number }` — pass the spread of
 * this into the `UpdateCustomFrontBodySchema`.
 */
export function encryptCustomFrontUpdate(
  data: CustomFrontEncryptedFields,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
