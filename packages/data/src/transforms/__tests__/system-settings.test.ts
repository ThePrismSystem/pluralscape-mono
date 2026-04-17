import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { brandId } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import {
  decryptNomenclature,
  decryptSystemSettings,
  encryptNomenclatureUpdate,
  encryptSystemSettingsUpdate,
} from "../system-settings.js";

import { makeBase64Blob } from "./helpers.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Locale,
  NomenclatureSettings,
  SystemId,
  SystemSettings,
  SystemSettingsId,
  UnixMillis,
} from "@pluralscape/types";

let masterKey: KdfMasterKey;

/** Build a minimal valid SystemSettings fixture. */
function makeSystemSettings(overrides?: Partial<SystemSettings>): SystemSettings {
  return {
    id: brandId<SystemSettingsId>("sys-settings-1"),
    systemId: brandId<SystemId>("system-1"),
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

/** Build a mock system settings server response. */
function makeRawSystemSettings(encryptedData: string, version = 1) {
  return {
    id: brandId<SystemSettingsId>("sys-settings-1"),
    systemId: brandId<SystemId>("system-1"),
    locale: null as Locale | null,
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
    systemId: brandId<SystemId>("system-1"),
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
    const raw = makeRawSystemSettings(makeBase64Blob(settings, masterKey));

    const result = decryptSystemSettings(raw, masterKey);
    expect(result).toEqual(settings);
  });

  it("preserves wire metadata over blob values", () => {
    const blobSettings = makeSystemSettings({
      version: 1,
      createdAt: 100 as UnixMillis,
      updatedAt: 200 as UnixMillis,
    });
    const raw = makeRawSystemSettings(makeBase64Blob(blobSettings, masterKey), 5);
    // Override wire metadata to differ from blob
    const rawWithWireMeta = {
      ...raw,
      id: brandId<SystemSettingsId>("sys-settings-wire"),
      systemId: brandId<SystemId>("system-wire"),
      version: 5,
      createdAt: 999 as UnixMillis,
      updatedAt: 1000 as UnixMillis,
    };

    const result = decryptSystemSettings(rawWithWireMeta, masterKey);
    expect(result.id).toBe("sys-settings-wire");
    expect(result.systemId).toBe("system-wire");
    expect(result.version).toBe(5);
    expect(result.createdAt).toBe(999);
    expect(result.updatedAt).toBe(1000);
  });

  it("decrypts settings with non-default theme and locale", () => {
    const settings = makeSystemSettings({ theme: "dark", locale: "en" as Locale | null });
    const raw = makeRawSystemSettings(makeBase64Blob(settings, masterKey));

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

  it("round-trips: encrypt then decrypt yields original data with wire version", () => {
    const settings = makeSystemSettings({ theme: "high-contrast", onboardingComplete: true });
    const { encryptedData, version } = encryptSystemSettingsUpdate(settings, 7, masterKey);
    const raw = makeRawSystemSettings(encryptedData, version);

    const decrypted = decryptSystemSettings(raw, masterKey);
    // Wire metadata (version, id, systemId, createdAt, updatedAt) comes from `raw`, not the blob
    expect(decrypted).toEqual({ ...settings, version: 7 });
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
  it("decrypts T1 blob to DecryptedNomenclature with wire version", () => {
    const nomenclature = makeNomenclature();
    const raw = makeRawNomenclature(makeBase64Blob(nomenclature, masterKey), 3);

    const result = decryptNomenclature(raw, masterKey);
    expect(result).toMatchObject({ ...nomenclature, version: 3 });
  });

  it("preserves wire version over any version in the blob", () => {
    const nomenclature = makeNomenclature();
    const raw = makeRawNomenclature(makeBase64Blob(nomenclature, masterKey), 7);

    const result = decryptNomenclature(raw, masterKey);
    expect(result.version).toBe(7);
  });

  it("decrypts customised terminology", () => {
    const nomenclature = makeNomenclature({ individual: "Alter", collective: "Collective" });
    const raw = makeRawNomenclature(makeBase64Blob(nomenclature, masterKey));

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

  it("round-trips: encrypt then decrypt yields original data with version", () => {
    const nomenclature = makeNomenclature({ fronting: "Driving", "primary-fronter": "Captain" });
    const { encryptedData, version } = encryptNomenclatureUpdate(nomenclature, 5, masterKey);
    const raw = makeRawNomenclature(encryptedData, version);

    const decrypted = decryptNomenclature(raw, masterKey);
    expect(decrypted).toMatchObject({ ...nomenclature, version: 5 });
  });

  it("produces different ciphertext on each call (nonce randomisation)", () => {
    const nomenclature = makeNomenclature();

    const { encryptedData: enc1 } = encryptNomenclatureUpdate(nomenclature, 1, masterKey);
    const { encryptedData: enc2 } = encryptNomenclatureUpdate(nomenclature, 1, masterKey);

    // XChaCha20-Poly1305 uses a random nonce — identical plaintexts differ
    expect(enc1).not.toBe(enc2);
  });
});

// ── Assertion guard tests ────────────────────────────────────────────

describe("assertSystemSettings", () => {
  it("throws when decrypted blob is not an object", () => {
    const raw = makeRawSystemSettings(makeBase64Blob("not-an-object", masterKey));
    expect(() => decryptSystemSettings(raw, masterKey)).toThrow("not an object");
  });

  it("throws when blob is missing theme field", () => {
    const raw = makeRawSystemSettings(makeBase64Blob({ fontScale: 1 }, masterKey));
    expect(() => decryptSystemSettings(raw, masterKey)).toThrow(
      "missing required string field: theme",
    );
  });
});

describe("assertNomenclatureSettings", () => {
  it("throws when decrypted blob is not an object", () => {
    const raw = makeRawNomenclature(makeBase64Blob("not-an-object", masterKey));
    expect(() => decryptNomenclature(raw, masterKey)).toThrow("not an object");
  });

  it("throws when decrypted blob is null inside valid T1 envelope", () => {
    const raw = makeRawNomenclature(makeBase64Blob(null, masterKey));
    expect(() => decryptNomenclature(raw, masterKey)).toThrow("not an object");
  });
});
