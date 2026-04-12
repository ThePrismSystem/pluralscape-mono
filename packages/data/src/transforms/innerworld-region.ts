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
  InnerWorldRegionId,
  MemberId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { VisualProperties } from "@pluralscape/types";

export interface InnerWorldRegionEncryptedFields {
  readonly name: string;
  readonly description: string | null;
  readonly boundaryData: readonly { readonly x: number; readonly y: number }[];
  readonly visual: VisualProperties;
  readonly gatekeeperMemberIds: readonly MemberId[];
  readonly accessType: "open" | "gatekept";
}

export interface InnerWorldRegionDecrypted {
  readonly id: InnerWorldRegionId;
  readonly systemId: SystemId;
  readonly parentRegionId: InnerWorldRegionId | null;
  readonly name: string;
  readonly description: string | null;
  readonly boundaryData: readonly { readonly x: number; readonly y: number }[];
  readonly visual: VisualProperties;
  readonly gatekeeperMemberIds: readonly MemberId[];
  readonly accessType: "open" | "gatekept";
  readonly archived: false;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

/** Compile-time check: encrypted fields must be a subset of the domain type. */
export type AssertInnerWorldRegionFieldsSubset =
  InnerWorldRegionEncryptedFields extends Pick<
    InnerWorldRegionDecrypted,
    keyof InnerWorldRegionEncryptedFields
  >
    ? true
    : never;

export type InnerWorldRegionRaw = Omit<
  InnerWorldRegionDecrypted,
  keyof InnerWorldRegionEncryptedFields | "archived"
> & {
  readonly encryptedData: string;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

export interface InnerWorldRegionPage {
  readonly data: readonly InnerWorldRegionRaw[];
  readonly nextCursor: string | null;
}

function assertInnerWorldRegionEncryptedFields(
  raw: unknown,
): asserts raw is InnerWorldRegionEncryptedFields {
  const obj = assertObjectBlob(raw, "innerworldRegion");
  assertStringField(obj, "innerworldRegion", "name");
}

export function decryptInnerWorldRegion(
  raw: InnerWorldRegionRaw,
  masterKey: KdfMasterKey,
): InnerWorldRegionDecrypted | Archived<InnerWorldRegionDecrypted> {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertInnerWorldRegionEncryptedFields(plaintext);

  const base = {
    id: raw.id,
    systemId: raw.systemId,
    parentRegionId: raw.parentRegionId,
    name: plaintext.name,
    description: plaintext.description,
    boundaryData: plaintext.boundaryData,
    visual: plaintext.visual,
    gatekeeperMemberIds: plaintext.gatekeeperMemberIds,
    accessType: plaintext.accessType,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived innerworldRegion missing archivedAt");
    return { ...base, archived: true as const, archivedAt: raw.archivedAt };
  }
  return { ...base, archived: false as const };
}

export function decryptInnerWorldRegionPage(
  raw: InnerWorldRegionPage,
  masterKey: KdfMasterKey,
): {
  data: (InnerWorldRegionDecrypted | Archived<InnerWorldRegionDecrypted>)[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map((item) => decryptInnerWorldRegion(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptInnerWorldRegionInput(
  data: InnerWorldRegionEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptInnerWorldRegionUpdate(
  data: InnerWorldRegionEncryptedFields,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
