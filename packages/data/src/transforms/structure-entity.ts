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
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

export interface StructureEntityEncryptedFields {
  readonly name: string;
  readonly description: string | null;
  readonly emoji: string | null;
  readonly color: HexColor | null;
  readonly imageSource: ImageSource | null;
}

export interface StructureEntityDecrypted {
  readonly id: SystemStructureEntityId;
  readonly systemId: SystemId;
  readonly entityTypeId: SystemStructureEntityTypeId;
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
export type AssertStructureEntityFieldsSubset =
  StructureEntityEncryptedFields extends Pick<
    StructureEntityDecrypted,
    keyof StructureEntityEncryptedFields
  >
    ? true
    : never;

export type StructureEntityRaw = Omit<
  StructureEntityDecrypted,
  keyof StructureEntityEncryptedFields | "archived"
> & {
  readonly encryptedData: string;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

export interface StructureEntityPage {
  readonly data: readonly StructureEntityRaw[];
  readonly nextCursor: string | null;
}

function assertStructureEntityEncryptedFields(
  raw: unknown,
): asserts raw is StructureEntityEncryptedFields {
  const obj = assertObjectBlob(raw, "structureEntity");
  assertStringField(obj, "structureEntity", "name");
}

export function decryptStructureEntity(
  raw: StructureEntityRaw,
  masterKey: KdfMasterKey,
): StructureEntityDecrypted | Archived<StructureEntityDecrypted> {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertStructureEntityEncryptedFields(plaintext);

  const base = {
    id: raw.id,
    systemId: raw.systemId,
    entityTypeId: raw.entityTypeId,
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
    if (raw.archivedAt === null) throw new Error("Archived structureEntity missing archivedAt");
    return { ...base, archived: true as const, archivedAt: raw.archivedAt };
  }
  return { ...base, archived: false as const };
}

export function decryptStructureEntityPage(
  raw: StructureEntityPage,
  masterKey: KdfMasterKey,
): {
  data: (StructureEntityDecrypted | Archived<StructureEntityDecrypted>)[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map((item) => decryptStructureEntity(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptStructureEntityInput(
  data: StructureEntityEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptStructureEntityUpdate(
  data: StructureEntityEncryptedFields,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
