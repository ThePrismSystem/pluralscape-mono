import { deserializeEncryptedBlob, serializeEncryptedBlob } from "@pluralscape/crypto";
import { customType } from "drizzle-orm/pg-core";

import type { EncryptedBlob } from "@pluralscape/types";

const JSON_PREVIEW_LENGTH = 100;

// ── Mapping functions (exported for independent testing) ───────

/** Converts UnixMillis to ISO string for PG timestamptz storage. */
export function timestampToDriver(ms: number): string {
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid timestamp: ${String(ms)} is not a finite number`);
  }
  return new Date(ms).toISOString();
}

/** Converts PG timestamptz string back to UnixMillis. */
export function timestampFromDriver(val: string): number {
  const ms = Date.parse(val);
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid timestamp string: "${val}" could not be parsed`);
  }
  return ms;
}

/** Converts Uint8Array to Buffer for PG bytea storage. */
export function binaryToDriver(val: Uint8Array): Buffer {
  return Buffer.from(val);
}

/** Converts PG bytea Buffer back to Uint8Array. */
export function binaryFromDriver(val: Buffer): Uint8Array {
  return new Uint8Array(val);
}

/** Converts JSON object to string for storage. */
export function jsonToDriver(val: unknown): string {
  return JSON.stringify(val);
}

/** Parses JSON string from storage. PGlite returns pre-parsed objects for JSONB; handle both. */
export function jsonFromDriver(val: unknown): unknown {
  if (typeof val !== "string") {
    return val;
  }
  try {
    return JSON.parse(val) as unknown;
  } catch (error: unknown) {
    const preview =
      val.length > JSON_PREVIEW_LENGTH ? `${val.slice(0, JSON_PREVIEW_LENGTH)}…` : val;
    throw new Error(`Failed to parse JSON from database: "${preview}"`, { cause: error });
  }
}

// ── Custom column types ────────────────────────────────────────

/** PG timestamptz column that maps to/from UnixMillis (number). */
export const pgTimestamp = customType<{ data: number; driverData: string }>({
  dataType() {
    return "timestamptz";
  },
  toDriver: timestampToDriver,
  fromDriver: timestampFromDriver,
});

/** PG bytea column that maps to/from Uint8Array. */
export const pgBinary = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
  toDriver: binaryToDriver,
  fromDriver: binaryFromDriver,
});

/** Converts EncryptedBlob to Buffer for PG bytea storage. */
export function encryptedBlobToDriver(val: EncryptedBlob): Buffer {
  return Buffer.from(serializeEncryptedBlob(val));
}

/** Converts PG bytea Buffer back to EncryptedBlob. */
export function encryptedBlobFromDriver(val: Buffer): EncryptedBlob {
  // Create a view over existing memory — deserializeEncryptedBlob makes defensive
  // copies of nonce and ciphertext internally, so no shared-memory risk.
  return deserializeEncryptedBlob(new Uint8Array(val.buffer, val.byteOffset, val.byteLength));
}

/**
 * PG bytea column that maps EncryptedBlob ↔ binary via blob-codec.
 * Nonce, keyVersion, tier, and bucketId are embedded in the wire format —
 * see blob-codec.ts for layout details.
 */
export const pgEncryptedBlob = customType<{ data: EncryptedBlob; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
  toDriver: encryptedBlobToDriver,
  fromDriver: encryptedBlobFromDriver,
});

/** PG jsonb column that maps to/from parsed JSON. */
export const pgJsonb = customType<{ data: unknown; driverData: string }>({
  dataType() {
    return "jsonb";
  },
  toDriver: jsonToDriver,
  fromDriver: jsonFromDriver,
});
