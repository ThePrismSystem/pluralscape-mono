import { deserializeEncryptedBlob, serializeEncryptedBlob } from "@pluralscape/crypto";
import { customType, text } from "drizzle-orm/sqlite-core";

import type { AnyBrandedId, EncryptedBlob } from "@pluralscape/types";

const JSON_PREVIEW_LENGTH = 100;

// ── Mapping functions (exported for independent testing) ───────

/** SQLite timestamp: passthrough (integer to integer). */
export function timestampToDriver(ms: number): number {
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid timestamp: ${String(ms)} is not a finite number`);
  }
  return ms;
}

/** SQLite timestamp: passthrough (integer to integer). */
export function timestampFromDriver(val: number): number {
  if (!Number.isFinite(val)) {
    throw new Error(`Invalid timestamp: ${String(val)} is not a finite number`);
  }
  return val;
}

/** SQLite JSON: stringify for text storage. */
export function jsonToDriver(val: unknown): string {
  return JSON.stringify(val);
}

/** SQLite JSON: parse from text storage. */
export function jsonFromDriver(val: string): unknown {
  try {
    return JSON.parse(val) as unknown;
  } catch (error: unknown) {
    const preview =
      val.length > JSON_PREVIEW_LENGTH ? `${val.slice(0, JSON_PREVIEW_LENGTH)}…` : val;
    throw new Error(`Failed to parse JSON from database: "${preview}"`, { cause: error });
  }
}

// ── Custom column types ────────────────────────────────────────

/** SQLite integer column that stores UnixMillis (passthrough). */
export const sqliteTimestamp = customType<{ data: number; driverData: number }>({
  dataType() {
    return "integer";
  },
  toDriver: timestampToDriver,
  fromDriver: timestampFromDriver,
});

/** SQLite blob column that maps to/from Uint8Array. */
export const sqliteBinary = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return "blob";
  },
  fromDriver(val: Uint8Array): Uint8Array {
    // better-sqlite3-multiple-ciphers returns Buffer (a Node.js subclass of Uint8Array).
    // Convert to plain Uint8Array for consistent cross-dialect behavior.
    return new Uint8Array(val);
  },
});

/** Converts EncryptedBlob to Uint8Array for SQLite blob storage. */
export function encryptedBlobToDriver(val: EncryptedBlob): Uint8Array {
  return serializeEncryptedBlob(val);
}

/** Converts SQLite blob back to EncryptedBlob. */
export function encryptedBlobFromDriver(val: Uint8Array): EncryptedBlob {
  // better-sqlite3-multiple-ciphers returns Buffer — create a view; deserializeEncryptedBlob
  // makes defensive copies of nonce and ciphertext internally.
  return deserializeEncryptedBlob(new Uint8Array(val.buffer, val.byteOffset, val.byteLength));
}

/**
 * SQLite blob column that maps EncryptedBlob ↔ binary via blob-codec.
 * Nonce, keyVersion, tier, and bucketId are embedded in the wire format —
 * see blob-codec.ts for layout details.
 */
export const sqliteEncryptedBlob = customType<{ data: EncryptedBlob; driverData: Uint8Array }>({
  dataType() {
    return "blob";
  },
  toDriver: encryptedBlobToDriver,
  fromDriver: encryptedBlobFromDriver,
});

/** SQLite text column that stores JSON (stringify/parse). */
export const sqliteJson = customType<{ data: unknown; driverData: string }>({
  dataType() {
    return "text";
  },
  toDriver: jsonToDriver,
  fromDriver: jsonFromDriver,
});

/**
 * Internal factory — returns a Drizzle text column builder with
 * `.$type<B>()` applied. Exists to let `brandedId` express its return
 * type as `ReturnType<typeof brandedIdImpl<B>>` without writing out the
 * full Drizzle builder shape (which drifts across drizzle-orm versions).
 */
function brandedIdImpl<B extends AnyBrandedId>(name: string) {
  return text(name).$type<B>();
}

/**
 * SQLite text column for a branded entity ID. Wraps `text(name)` with
 * `.$type<B>()` so `InferSelectModel` / `InferInsertModel` return the
 * branded type. Chainable with `.primaryKey()`, `.notNull()`, `.references()`, etc.
 */
export function brandedId<B extends AnyBrandedId>(
  name: string,
): ReturnType<typeof brandedIdImpl<B>> {
  return brandedIdImpl<B>(name);
}
