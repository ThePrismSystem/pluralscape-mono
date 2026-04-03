import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { AcknowledgementId, MemberId, SystemId, UnixMillis } from "@pluralscape/types";

// ── Wire types (API response shapes) ─────────────────────────────────

/** Shape returned by `acknowledgement.get` and `acknowledgement.list` items. */
interface AcknowledgementRaw {
  readonly id: AcknowledgementId;
  readonly systemId: SystemId;
  readonly createdByMemberId: MemberId | null;
  readonly confirmed: boolean;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

/** Shape returned by `acknowledgement.list`. */
interface AcknowledgementPage {
  readonly data: readonly AcknowledgementRaw[];
  readonly nextCursor: string | null;
}

// ── Encrypted payload types ───────────────────────────────────────────

/**
 * The plaintext fields encrypted inside an acknowledgement blob.
 * Pass this to `encryptAcknowledgementInput` when creating a request,
 * or to `encryptAcknowledgementConfirm` when confirming one.
 */
export interface AcknowledgementEncryptedFields {
  readonly message: string;
  readonly targetMemberId: MemberId;
  readonly confirmedAt: UnixMillis | null;
}

// ── Decrypted output type ─────────────────────────────────────────────

/** A fully decrypted acknowledgement, combining wire metadata with plaintext fields. */
export interface AcknowledgementDecrypted {
  readonly id: AcknowledgementId;
  readonly systemId: SystemId;
  readonly createdByMemberId: MemberId | null;
  readonly targetMemberId: MemberId;
  readonly message: string;
  readonly confirmed: boolean;
  readonly confirmedAt: UnixMillis | null;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

// ── Validators ────────────────────────────────────────────────────────

function assertAcknowledgementEncryptedFields(
  raw: unknown,
): asserts raw is AcknowledgementEncryptedFields {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Decrypted acknowledgement blob is not an object");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj["message"] !== "string") {
    throw new Error("Decrypted acknowledgement blob missing required string field: message");
  }
  if (typeof obj["targetMemberId"] !== "string") {
    throw new Error("Decrypted acknowledgement blob missing required string field: targetMemberId");
  }
}

// ── Acknowledgement transforms ────────────────────────────────────────

/**
 * Decrypt a single acknowledgement request API result.
 *
 * The encrypted blob contains: `message`, `targetMemberId`, `confirmedAt`.
 * All other fields pass through from the wire payload.
 */
export function decryptAcknowledgement(
  raw: AcknowledgementRaw,
  masterKey: KdfMasterKey,
): AcknowledgementDecrypted {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertAcknowledgementEncryptedFields(plaintext);

  return {
    id: raw.id,
    systemId: raw.systemId,
    createdByMemberId: raw.createdByMemberId,
    targetMemberId: plaintext.targetMemberId,
    message: plaintext.message,
    confirmed: raw.confirmed,
    confirmedAt: plaintext.confirmedAt,
    archived: raw.archived,
    archivedAt: raw.archivedAt,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/**
 * Decrypt a paginated acknowledgement list result.
 */
export function decryptAcknowledgementPage(
  raw: AcknowledgementPage,
  masterKey: KdfMasterKey,
): { data: AcknowledgementDecrypted[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptAcknowledgement(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

/**
 * Encrypt acknowledgement plaintext fields for create payloads.
 */
export function encryptAcknowledgementInput(
  data: AcknowledgementEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

/**
 * Encrypt acknowledgement plaintext fields for update payloads.
 */
export function encryptAcknowledgementUpdate(
  data: AcknowledgementEncryptedFields,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}

/**
 * Encrypt acknowledgement plaintext fields for confirm mutations.
 * Uses `encryptInput` (not versioned update) since confirm sends a full blob.
 */
export function encryptAcknowledgementConfirm(
  data: AcknowledgementEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}
