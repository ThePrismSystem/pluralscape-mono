import { CustomFrontEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  CustomFront,
  CustomFrontEncryptedFields,
  UnixMillis,
} from "@pluralscape/types";

// ── Encrypted payload type ────────────────────────────────────────────

/**
 * Shape passed to `encryptCustomFrontInput()` / `encryptCustomFrontUpdate()`
 * before encryption. Derived from the `CustomFront` domain type by picking
 * the encrypted-field keys — single source of truth lives in
 * `@pluralscape/types`.
 */
export type CustomFrontEncryptedInput = Pick<CustomFront, CustomFrontEncryptedFields>;

// ── Wire types (derived from domain types) ──────────────────────────

/** Wire shape returned by `customFront.get` — derived from the `CustomFront` domain type. */
export type CustomFrontRaw = Omit<CustomFront, CustomFrontEncryptedFields | "archived"> & {
  readonly encryptedData: string;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

/** Shape returned by `customFront.list`. */
export interface CustomFrontPage {
  readonly data: readonly CustomFrontRaw[];
  readonly nextCursor: string | null;
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
  const validated = CustomFrontEncryptedInputSchema.parse(plaintext);

  const base = {
    id: raw.id,
    systemId: raw.systemId,
    name: validated.name,
    description: validated.description,
    color: validated.color,
    emoji: validated.emoji,
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
  data: CustomFrontEncryptedInput,
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
  data: CustomFrontEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
