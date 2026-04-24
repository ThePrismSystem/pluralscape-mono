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
  InnerWorldRegion,
  InnerWorldRegionEncryptedFields,
  UnixMillis,
} from "@pluralscape/types";

/**
 * Plaintext shape of a decrypted innerworld region blob — derived from the SoT
 * `InnerWorldRegion` domain type.
 */
export type InnerWorldRegionPlaintext = Pick<InnerWorldRegion, InnerWorldRegionEncryptedFields>;

/** Wire shape returned by `innerworld.region.get` — derived from `InnerWorldRegion`. */
export type InnerWorldRegionRaw = Omit<
  InnerWorldRegion,
  InnerWorldRegionEncryptedFields | "archived"
> & {
  readonly encryptedData: string;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

export interface InnerWorldRegionPage {
  readonly data: readonly InnerWorldRegionRaw[];
  readonly nextCursor: string | null;
}

function assertInnerWorldRegionPlaintext(raw: unknown): asserts raw is InnerWorldRegionPlaintext {
  const obj = assertObjectBlob(raw, "innerworldRegion");
  assertStringField(obj, "innerworldRegion", "name");
}

export function decryptInnerWorldRegion(
  raw: InnerWorldRegionRaw,
  masterKey: KdfMasterKey,
): InnerWorldRegion | Archived<InnerWorldRegion> {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertInnerWorldRegionPlaintext(plaintext);

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
  data: (InnerWorldRegion | Archived<InnerWorldRegion>)[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map((item) => decryptInnerWorldRegion(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptInnerWorldRegionInput(
  data: InnerWorldRegionPlaintext,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptInnerWorldRegionUpdate(
  data: InnerWorldRegionPlaintext,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
