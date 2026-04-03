import {
  configureSodium,
  encryptTier1,
  generateMasterKey,
  initSodium,
  serializeEncryptedBlob,
} from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  decryptNomenclature,
  decryptSystemSettings,
  encryptNomenclatureUpdate,
  encryptSystemSettingsUpdate,
} from "../system-settings.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  NomenclatureSettings,
  SystemId,
  SystemSettings,
  SystemSettingsId,
  UnixMillis,
} from "@pluralscape/types";

let masterKey: KdfMasterKey;

/** Convert Uint8Array to base64 without Buffer. */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** Build a minimal valid SystemSettings fixture. */
function makeSystemSettings(overrides?: Partial<SystemSettings>): SystemSettings {
  return {
    id: "sys-settings-1" as SystemSettingsId,
    systemId: "system-1" as SystemId,
    theme: "system",
    fontScale: 1,
    locale: null,
    defaultBucketId: null,
    appLock: {
      pinEnabled: false,
      biometricEnabled: false,
      lockTimeout: 5,
      backgroundGraceSeconds: 30,
    },
    notifications: {
      pushEnabled: true,
      emailEnabled: false,
      switchReminders: false,
      checkInReminders: false,
    },
    syncPreferences: {
      syncEnabled: true,
      syncOnCellular: false,
    },
    privacyDefaults: {
      defaultBucketForNewContent: null,
      friendRequestPolicy: "open",
    },
    littlesSafeMode: {
      enabled: false,
      allowedContentIds: [],
      simplifiedUIFlags: {
        largeButtons: false,
        iconDriven: false,
        noDeletion: false,
        noSettings: false,
        noAnalytics: false,
      },
    },
    nomenclature: {
      collective: "System",
      individual: "Member",
      fronting: "Fronting",
      switching: "Switch",
      "co-presence": "Co-fronting",
      "internal-space": "Headspace",
      "primary-fronter": "Host",
      structure: "System Structure",
      dormancy: "Dormancy",
      body: "Body",
      amnesia: "Amnesia",
      saturation: "Saturation",
    },
    saturationLevelsEnabled: false,
    autoCaptureFrontingOnJournal: false,
    snapshotSchedule: "disabled",
    onboardingComplete: false,
    version: 1,
    createdAt: 0 as UnixMillis,
    updatedAt: 0 as UnixMillis,
    ...overrides,
  };
}

/** Build a minimal valid NomenclatureSettings fixture. */
function makeNomenclature(overrides?: Partial<NomenclatureSettings>): NomenclatureSettings {
  return {
    collective: "System",
    individual: "Member",
    fronting: "Fronting",
    switching: "Switch",
    "co-presence": "Co-fronting",
    "internal-space": "Headspace",
    "primary-fronter": "Host",
    structure: "System Structure",
    dormancy: "Dormancy",
    body: "Body",
    amnesia: "Amnesia",
    saturation: "Saturation",
    ...overrides,
  };
}

/** Encrypt data as T1 and return base64-encoded blob. */
function encryptToBase64(data: unknown, key: KdfMasterKey): string {
  const blob = encryptTier1(data, key);
  return toBase64(serializeEncryptedBlob(blob));
}

/** Build a mock system settings server response. */
function makeRawSystemSettings(encryptedData: string, version = 1) {
  return {
    id: "sys-settings-1" as SystemSettingsId,
    systemId: "system-1" as SystemId,
    locale: null as string | null,
    biometricEnabled: false,
    encryptedData,
    version,
    createdAt: 0 as UnixMillis,
    updatedAt: 0 as UnixMillis,
  };
}

/** Build a mock nomenclature settings server response. */
function makeRawNomenclature(encryptedData: string, version = 1) {
  return {
    systemId: "system-1" as SystemId,
    encryptedData,
    version,
    createdAt: 0 as UnixMillis,
    updatedAt: 0 as UnixMillis,
  };
}

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

// ── decryptSystemSettings ────────────────────────────────────────────

describe("decryptSystemSettings", () => {
  it("decrypts T1 blob to SystemSettings", () => {
    const settings = makeSystemSettings();
    const raw = makeRawSystemSettings(encryptToBase64(settings, masterKey));

    const result = decryptSystemSettings(raw, masterKey);
    expect(result).toEqual(settings);
  });

  it("decrypts settings with non-default theme and locale", () => {
    const settings = makeSystemSettings({ theme: "dark", locale: "en" });
    const raw = makeRawSystemSettings(encryptToBase64(settings, masterKey));

    const result = decryptSystemSettings(raw, masterKey);
    expect(result).toMatchObject({ theme: "dark", locale: "en" });
  });

  it("throws on corrupted encryptedData", () => {
    const raw = makeRawSystemSettings("bm90LXZhbGlk");
    expect(() => decryptSystemSettings(raw, masterKey)).toThrow();
  });

  it("throws on invalid base64", () => {
    const raw = makeRawSystemSettings("!!!not-base64!!!");
    expect(() => decryptSystemSettings(raw, masterKey)).toThrow();
  });
});

// ── encryptSystemSettingsUpdate ──────────────────────────────────────

describe("encryptSystemSettingsUpdate", () => {
  it("returns encryptedData and version", () => {
    const settings = makeSystemSettings();
    const result = encryptSystemSettingsUpdate(settings, 3, masterKey);

    expect(typeof result.encryptedData).toBe("string");
    expect(result.version).toBe(3);
  });

  it("round-trips: encrypt then decrypt yields original data", () => {
    const settings = makeSystemSettings({ theme: "high-contrast", onboardingComplete: true });
    const { encryptedData, version } = encryptSystemSettingsUpdate(settings, 7, masterKey);
    const raw = makeRawSystemSettings(encryptedData, version);

    const decrypted = decryptSystemSettings(raw, masterKey);
    expect(decrypted).toEqual(settings);
  });

  it("produces different ciphertext for different inputs", () => {
    const a = makeSystemSettings({ theme: "light" });
    const b = makeSystemSettings({ theme: "dark" });

    const { encryptedData: enc1 } = encryptSystemSettingsUpdate(a, 1, masterKey);
    const { encryptedData: enc2 } = encryptSystemSettingsUpdate(b, 1, masterKey);

    expect(enc1).not.toBe(enc2);
  });
});

// ── decryptNomenclature ──────────────────────────────────────────────

describe("decryptNomenclature", () => {
  it("decrypts T1 blob to NomenclatureSettings", () => {
    const nomenclature = makeNomenclature();
    const raw = makeRawNomenclature(encryptToBase64(nomenclature, masterKey));

    const result = decryptNomenclature(raw, masterKey);
    expect(result).toEqual(nomenclature);
  });

  it("decrypts customised terminology", () => {
    const nomenclature = makeNomenclature({ individual: "Alter", collective: "Collective" });
    const raw = makeRawNomenclature(encryptToBase64(nomenclature, masterKey));

    const result = decryptNomenclature(raw, masterKey);
    expect(result).toMatchObject({ individual: "Alter", collective: "Collective" });
  });

  it("throws on corrupted encryptedData", () => {
    const raw = makeRawNomenclature("bm90LXZhbGlk");
    expect(() => decryptNomenclature(raw, masterKey)).toThrow();
  });
});

// ── encryptNomenclatureUpdate ────────────────────────────────────────

describe("encryptNomenclatureUpdate", () => {
  it("returns encryptedData and version", () => {
    const nomenclature = makeNomenclature();
    const result = encryptNomenclatureUpdate(nomenclature, 2, masterKey);

    expect(typeof result.encryptedData).toBe("string");
    expect(result.version).toBe(2);
  });

  it("round-trips: encrypt then decrypt yields original data", () => {
    const nomenclature = makeNomenclature({ fronting: "Driving", "primary-fronter": "Captain" });
    const { encryptedData, version } = encryptNomenclatureUpdate(nomenclature, 5, masterKey);
    const raw = makeRawNomenclature(encryptedData, version);

    const decrypted = decryptNomenclature(raw, masterKey);
    expect(decrypted).toEqual(nomenclature);
  });

  it("produces different ciphertext on each call (nonce randomisation)", () => {
    const nomenclature = makeNomenclature();

    const { encryptedData: enc1 } = encryptNomenclatureUpdate(nomenclature, 1, masterKey);
    const { encryptedData: enc2 } = encryptNomenclatureUpdate(nomenclature, 1, masterKey);

    // XChaCha20-Poly1305 uses a random nonce — identical plaintexts differ
    expect(enc1).not.toBe(enc2);
  });
});
