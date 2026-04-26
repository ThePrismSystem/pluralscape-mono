import { brandId, toUnixMillis } from "@pluralscape/types";
import { PrivacyBucketEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  BucketId,
  PrivacyBucket,
  PrivacyBucketEncryptedInput,
  PrivacyBucketWire,
  SystemId,
} from "@pluralscape/types";

/** Shape returned by `privacyBucket.list`. */
export interface PrivacyBucketPage {
  readonly data: readonly PrivacyBucketWire[];
  readonly nextCursor: string | null;
}

export function decryptPrivacyBucket(
  raw: PrivacyBucketWire,
  masterKey: KdfMasterKey,
): PrivacyBucket | Archived<PrivacyBucket> {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = PrivacyBucketEncryptedInputSchema.parse(decrypted);

  const base = {
    id: brandId<BucketId>(raw.id),
    systemId: brandId<SystemId>(raw.systemId),
    version: raw.version,
    createdAt: toUnixMillis(raw.createdAt),
    updatedAt: toUnixMillis(raw.updatedAt),
    name: validated.name,
    description: validated.description,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived privacy bucket missing archivedAt");
    return { ...base, archived: true as const, archivedAt: toUnixMillis(raw.archivedAt) };
  }
  return { ...base, archived: false as const };
}

export function decryptPrivacyBucketPage(
  raw: PrivacyBucketPage,
  masterKey: KdfMasterKey,
): { data: (PrivacyBucket | Archived<PrivacyBucket>)[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptPrivacyBucket(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptBucketInput(
  data: PrivacyBucketEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptBucketUpdate(
  data: PrivacyBucketEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
