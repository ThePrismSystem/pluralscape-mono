import { decodeAndDecryptT1, encryptAndEncodeT1 } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  CustomFront,
  CustomFrontId,
  HexColor,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

// ── Wire types (API response shapes) ─────────────────────────────────

/** Shape returned by `customFront.get` and items in `customFront.list`. */
interface CustomFrontRaw {
  readonly id: CustomFrontId;
  readonly systemId: SystemId;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

/** Shape returned by `customFront.list`. */
interface CustomFrontPage {
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
export function decryptCustomFront(raw: CustomFrontRaw, masterKey: KdfMasterKey): CustomFront {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertCustomFrontEncryptedFields(plaintext);
  return {
    id: raw.id,
    systemId: raw.systemId,
    name: plaintext.name,
    description: plaintext.description,
    color: plaintext.color,
    emoji: plaintext.emoji,
    archived: false,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/**
 * Decrypt a paginated custom front list result.
 *
 * Returns `{ items: CustomFront[]; nextCursor: string | null }`.
 */
export function decryptCustomFrontPage(
  raw: CustomFrontPage,
  masterKey: KdfMasterKey,
): { items: CustomFront[]; nextCursor: string | null } {
  return {
    items: raw.data.map((item) => decryptCustomFront(item, masterKey)),
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
  return { encryptedData: encryptAndEncodeT1(data, masterKey) };
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
  return { encryptedData: encryptAndEncodeT1(data, masterKey), version };
}
