import { decodeAndDecryptT1, encryptAndEncodeT1 } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  NomenclatureSettings,
  SystemId,
  SystemSettings,
  SystemSettingsId,
  UnixMillis,
} from "@pluralscape/types";

// ── Wire types (API response shapes) ─────────────────────────────────

/** Shape returned by `systemSettings.settings.get`. */
interface SystemSettingsRaw {
  readonly id: SystemSettingsId;
  readonly systemId: SystemId;
  readonly locale: string | null;
  readonly biometricEnabled: boolean;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

/** Shape returned by `systemSettings.nomenclature.get`. */
interface NomenclatureSettingsRaw {
  readonly systemId: SystemId;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

// ── Validators ───────────────────────────────────────────────────────

function assertSystemSettings(raw: unknown): asserts raw is SystemSettings {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Decrypted system settings blob is not an object");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj["theme"] !== "string") {
    throw new Error("Decrypted system settings blob missing required string field: theme");
  }
}

function assertNomenclatureSettings(raw: unknown): asserts raw is NomenclatureSettings {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Decrypted nomenclature settings blob is not an object");
  }
}

// ── System settings transforms ────────────────────────────────────────

/**
 * Decrypt the T1-encrypted blob in a system settings server response.
 *
 * Flow: base64 encryptedData → T1 blob → SystemSettings
 */
export function decryptSystemSettings(
  raw: SystemSettingsRaw,
  masterKey: KdfMasterKey,
): SystemSettings {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertSystemSettings(plaintext);
  return plaintext;
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
  return {
    encryptedData: encryptAndEncodeT1(data, masterKey),
    version,
  };
}

// ── Nomenclature settings transforms ─────────────────────────────────

/**
 * Decrypt the T1-encrypted blob in a nomenclature settings server response.
 *
 * Flow: base64 encryptedData → T1 blob → NomenclatureSettings
 */
export function decryptNomenclature(
  raw: NomenclatureSettingsRaw,
  masterKey: KdfMasterKey,
): NomenclatureSettings {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertNomenclatureSettings(plaintext);
  return plaintext;
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
  return {
    encryptedData: encryptAndEncodeT1(data, masterKey),
    version,
  };
}
