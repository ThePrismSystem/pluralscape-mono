import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { GroupId, HexColor, ImageSource, SystemId, UnixMillis } from "@pluralscape/types";

// ── Encrypted payload types ───────────────────────────────────────────

/**
 * The plaintext fields encrypted inside a group blob.
 * Pass this to `encryptGroupInput` or `encryptGroupUpdate`.
 */
export interface GroupEncryptedFields {
  readonly name: string;
  readonly description: string | null;
  readonly imageSource: ImageSource | null;
  readonly color: HexColor | null;
  readonly emoji: string | null;
}

// ── Decrypted output type ─────────────────────────────────────────────

/** A fully decrypted group, combining wire metadata with plaintext fields. */
export interface GroupDecrypted {
  readonly id: GroupId;
  readonly systemId: SystemId;
  readonly parentGroupId: GroupId | null;
  readonly sortOrder: number;
  readonly name: string;
  readonly description: string | null;
  readonly imageSource: ImageSource | null;
  readonly color: HexColor | null;
  readonly emoji: string | null;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

/** Compile-time check: encrypted fields must be a subset of the domain type. */
export type AssertGroupFieldsSubset =
  GroupEncryptedFields extends Pick<GroupDecrypted, keyof GroupEncryptedFields> ? true : never;

// ── Wire types (derived from domain types) ──────────────────────────

/** Wire shape returned by `group.get` — derived from `GroupDecrypted`. */
export type GroupRaw = Omit<GroupDecrypted, keyof GroupEncryptedFields> & {
  readonly encryptedData: string;
};

/** Shape returned by `group.list`. */
export interface GroupPage {
  readonly data: readonly GroupRaw[];
  readonly nextCursor: string | null;
}

// ── Validator ─────────────────────────────────────────────────────────

function assertGroupEncryptedFields(raw: unknown): asserts raw is GroupEncryptedFields {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Decrypted group blob is not an object");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj["name"] !== "string") {
    throw new Error("Decrypted group blob missing required string field: name");
  }
  if (obj["description"] !== null && typeof obj["description"] !== "string") {
    throw new Error("Decrypted group blob: description must be string or null");
  }
  if (obj["color"] !== null && typeof obj["color"] !== "string") {
    throw new Error("Decrypted group blob: color must be string or null");
  }
  if (obj["emoji"] !== null && typeof obj["emoji"] !== "string") {
    throw new Error("Decrypted group blob: emoji must be string or null");
  }
  if (obj["imageSource"] !== null && typeof obj["imageSource"] !== "object") {
    throw new Error("Decrypted group blob: imageSource must be object or null");
  }
}

// ── Group transforms ──────────────────────────────────────────────────

/**
 * Decrypt a single group API result into a `GroupDecrypted`.
 *
 * The encrypted blob contains: `name`, `description`, `imageSource`, `color`, `emoji`.
 * All other fields pass through from the wire payload.
 */
export function decryptGroup(raw: GroupRaw, masterKey: KdfMasterKey): GroupDecrypted {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertGroupEncryptedFields(plaintext);
  return {
    id: raw.id,
    systemId: raw.systemId,
    parentGroupId: raw.parentGroupId,
    sortOrder: raw.sortOrder,
    name: plaintext.name,
    description: plaintext.description,
    imageSource: plaintext.imageSource,
    color: plaintext.color,
    emoji: plaintext.emoji,
    archived: raw.archived,
    archivedAt: raw.archivedAt,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/**
 * Decrypt a paginated group list result.
 */
export function decryptGroupPage(
  raw: GroupPage,
  masterKey: KdfMasterKey,
): { data: GroupDecrypted[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptGroup(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

/**
 * Encrypt group plaintext fields for create payloads.
 *
 * Returns `{ encryptedData: string }` — pass the spread of this into
 * `CreateGroupBodySchema`.
 */
export function encryptGroupInput(
  data: GroupEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

/**
 * Encrypt group plaintext fields for update payloads.
 *
 * Returns `{ encryptedData: string; version: number }` — pass the spread
 * of this into `UpdateGroupBodySchema`.
 */
export function encryptGroupUpdate(
  data: GroupEncryptedFields,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
