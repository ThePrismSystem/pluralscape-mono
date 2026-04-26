import { brandId, createDefaultNomenclatureSettings, toUnixMillis } from "@pluralscape/types";
import {
  NomenclatureSettingsEncryptedInputSchema,
  SystemSettingsEncryptedInputSchema,
} from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  BucketId,
  EncryptedWire,
  NomenclatureSettings,
  NomenclatureServerMetadata,
  Serialize,
  SystemId,
  SystemSettings,
  SystemSettingsEncryptedInput,
  SystemSettingsId,
  SystemSettingsWire,
} from "@pluralscape/types";

/** JSON-wire shape of the `nomenclature_settings` row. */
export type NomenclatureSettingsWire = Serialize<EncryptedWire<NomenclatureServerMetadata>>;

/** Decrypted nomenclature with wire version for optimistic locking. */
export interface DecryptedNomenclature extends NomenclatureSettings {
  readonly version: number;
}

/**
 * Decrypt the T1-encrypted blob in a system settings server response.
 *
 * Wire metadata (id, systemId, version, createdAt, updatedAt) is taken from
 * the server response rather than the blob to avoid stale values.
 * `defaultBucketId` is encoded in the encrypted blob (per ADR-023's
 * `SystemSettingsServerMetadata` Omit list) and surfaced through the
 * settings payload itself; `nomenclature` is fetched separately.
 */
export function decryptSystemSettings(
  raw: SystemSettingsWire,
  masterKey: KdfMasterKey,
): SystemSettings {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated: SystemSettingsEncryptedInput =
    SystemSettingsEncryptedInputSchema.parse(decrypted);
  const blob = decrypted as {
    readonly defaultBucketId?: BucketId | null;
    readonly nomenclature?: NomenclatureSettings;
  };
  return {
    ...validated,
    id: brandId<SystemSettingsId>(raw.id),
    systemId: brandId<SystemId>(raw.systemId),
    locale: raw.locale,
    defaultBucketId: blob.defaultBucketId ?? null,
    nomenclature: blob.nomenclature ?? createDefaultNomenclatureSettings(),
    version: raw.version,
    createdAt: toUnixMillis(raw.createdAt),
    updatedAt: toUnixMillis(raw.updatedAt),
  };
}

/**
 * Encrypt updated system settings for submission to the server.
 *
 * Flow: SystemSettings → T1 blob → base64 encryptedData
 */
export function encryptSystemSettingsUpdate(
  data: SystemSettings,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}

/**
 * Decrypt the T1-encrypted blob in a nomenclature settings server response.
 * Preserves `version` from the wire response for optimistic locking.
 */
export function decryptNomenclature(
  raw: NomenclatureSettingsWire,
  masterKey: KdfMasterKey,
): DecryptedNomenclature {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = NomenclatureSettingsEncryptedInputSchema.parse(
    decrypted,
  ) as NomenclatureSettings;
  return { ...validated, version: raw.version };
}

/**
 * Encrypt updated nomenclature settings for submission to the server.
 *
 * Flow: NomenclatureSettings → T1 blob → base64 encryptedData
 */
export function encryptNomenclatureUpdate(
  data: NomenclatureSettings,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
