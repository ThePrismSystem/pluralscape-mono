import {
  assertObjectBlob,
  assertStringField,
  decodeAndDecryptT1,
  encryptInput,
  encryptUpdate,
} from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  HexColor,
  ImageSource,
  SystemStructureEntityTypeId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
// ── Encrypted payload types ───────────────────────────────────────────

export interface StructureEntityTypeEncryptedFields {
  readonly name: string;
  readonly description: string | null;
  readonly emoji: string | null;
  readonly color: HexColor | null;
  readonly imageSource: ImageSource | null;
}

// ── Decrypted output type ─────────────────────────────────────────────

export interface StructureEntityTypeDecrypted {
  readonly id: SystemStructureEntityTypeId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
  readonly emoji: string | null;
  readonly color: HexColor | null;
  readonly imageSource: ImageSource | null;
  readonly sortOrder: number;
  readonly archived: false;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

/** Compile-time check: encrypted fields must be a subset of the domain type. */
export type AssertStructureEntityTypeFieldsSubset =
  StructureEntityTypeEncryptedFields extends Pick<
    StructureEntityTypeDecrypted,
    keyof StructureEntityTypeEncryptedFields
  >
    ? true
    : never;

// ── Wire types ────────────────────────────────────────────────────────

export type StructureEntityTypeRaw = Omit<
  StructureEntityTypeDecrypted,
  keyof StructureEntityTypeEncryptedFields | "archived"
> & {
  readonly encryptedData: string;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

export interface StructureEntityTypePage {
  readonly data: readonly StructureEntityTypeRaw[];
  readonly nextCursor: string | null;
}

// ── Validators ────────────────────────────────────────────────────────

function assertStructureEntityTypeEncryptedFields(
  raw: unknown,
): asserts raw is StructureEntityTypeEncryptedFields {
  const obj = assertObjectBlob(raw, "structureEntityType");
  assertStringField(obj, "structureEntityType", "name");
}

// ── Transforms ────────────────────────────────────────────────────────

export function decryptStructureEntityType(
  raw: StructureEntityTypeRaw,
  masterKey: KdfMasterKey,
): StructureEntityTypeDecrypted | Archived<StructureEntityTypeDecrypted> {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertStructureEntityTypeEncryptedFields(plaintext);

  const base = {
    id: raw.id,
    systemId: raw.systemId,
    name: plaintext.name,
    description: plaintext.description,
    emoji: plaintext.emoji,
    color: plaintext.color,
    imageSource: plaintext.imageSource,
    sortOrder: raw.sortOrder,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived structureEntityType missing archivedAt");
    return { ...base, archived: true as const, archivedAt: raw.archivedAt };
  }
  return { ...base, archived: false as const };
}

export function decryptStructureEntityTypePage(
  raw: StructureEntityTypePage,
  masterKey: KdfMasterKey,
): {
  data: (StructureEntityTypeDecrypted | Archived<StructureEntityTypeDecrypted>)[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map((item) => decryptStructureEntityType(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptStructureEntityTypeInput(
  data: StructureEntityTypeEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptStructureEntityTypeUpdate(
  data: StructureEntityTypeEncryptedFields,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
