// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import {
  encryptNomenclatureUpdate,
  encryptSystemSettingsUpdate,
} from "@pluralscape/data/transforms/system-settings";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./helpers/test-crypto.js";

import type {
  NomenclatureSettingsRaw,
  SystemSettingsRaw,
} from "@pluralscape/data/transforms/system-settings";
import type { SystemSettingsId, UnixMillis } from "@pluralscape/types";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return { ...(actual as object), useCallback: (fn: unknown) => fn };
});

// ── Capture tRPC hook calls ──────────────────────────────────────────
type CapturedOpts = Record<string, unknown>;
let lastSettingsQueryOpts: CapturedOpts = {};
let lastNomenclatureQueryOpts: CapturedOpts = {};
let lastUpdateSettingsOpts: CapturedOpts = {};
let lastUpdateNomenclatureOpts: CapturedOpts = {};
let lastSetPinOpts: CapturedOpts = {};
let lastRemovePinOpts: CapturedOpts = {};
let lastVerifyPinOpts: CapturedOpts = {};

const mockUtils = {
  systemSettings: {
    settings: { get: { invalidate: vi.fn() } },
    nomenclature: { get: { invalidate: vi.fn() } },
  },
};

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    systemSettings: {
      settings: {
        get: {
          useQuery: (_input: unknown, opts: CapturedOpts) => {
            lastSettingsQueryOpts = opts;
            return { data: undefined, isLoading: true, status: "loading" };
          },
        },
        update: {
          useMutation: (opts: CapturedOpts) => {
            lastUpdateSettingsOpts = opts;
            return { mutate: vi.fn() };
          },
        },
      },
      nomenclature: {
        get: {
          useQuery: (_input: unknown, opts: CapturedOpts) => {
            lastNomenclatureQueryOpts = opts;
            return { data: undefined, isLoading: true, status: "loading" };
          },
        },
        update: {
          useMutation: (opts: CapturedOpts) => {
            lastUpdateNomenclatureOpts = opts;
            return { mutate: vi.fn() };
          },
        },
      },
      pin: {
        set: {
          useMutation: (opts?: CapturedOpts) => {
            lastSetPinOpts = opts ?? {};
            return { mutate: vi.fn() };
          },
        },
        remove: {
          useMutation: (opts?: CapturedOpts) => {
            lastRemovePinOpts = opts ?? {};
            return { mutate: vi.fn() };
          },
        },
        verify: {
          useMutation: (opts?: CapturedOpts) => {
            lastVerifyPinOpts = opts ?? {};
            return { mutate: vi.fn() };
          },
        },
      },
    },
    useUtils: () => mockUtils,
  },
}));

vi.mock("../../providers/crypto-provider.js", () => ({
  useMasterKey: vi.fn(() => TEST_MASTER_KEY),
}));
vi.mock("../../providers/system-provider.js", () => ({
  useActiveSystemId: vi.fn(() => TEST_SYSTEM_ID),
}));

const { useMasterKey } = await import("../../providers/crypto-provider.js");
const {
  useSystemSettings,
  useNomenclature,
  useUpdateSettings,
  useUpdateNomenclature,
  useSetPin,
  useRemovePin,
  useVerifyPin,
} = await import("../use-system-settings.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;
const SETTINGS_ID = "ss-1" as SystemSettingsId;

function makeSystemSettingsPayload() {
  return {
    id: SETTINGS_ID,
    systemId: TEST_SYSTEM_ID,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    theme: "dark" as const,
    fontScale: 1.0,
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
      friendRequestPolicy: "open" as const,
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
    saturationLevelsEnabled: true,
    autoCaptureFrontingOnJournal: false,
    snapshotSchedule: "disabled" as const,
    onboardingComplete: false,
  };
}

function makeRawSystemSettings(): SystemSettingsRaw {
  const settings = makeSystemSettingsPayload();
  const encrypted = encryptSystemSettingsUpdate(settings, 1, TEST_MASTER_KEY);
  return {
    id: SETTINGS_ID,
    systemId: TEST_SYSTEM_ID,
    locale: null,
    biometricEnabled: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
  };
}

function makeRawNomenclature(): NomenclatureSettingsRaw {
  const nomenclature = {
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
  };
  const encrypted = encryptNomenclatureUpdate(nomenclature, 1, TEST_MASTER_KEY);
  return {
    systemId: TEST_SYSTEM_ID,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
  };
}

// ── Tests ────────────────────────────────────────────────────────────
describe("useSystemSettings", () => {
  it("enables when masterKey is present", () => {
    useSystemSettings();
    expect(lastSettingsQueryOpts["enabled"]).toBe(true);
  });

  it("disables when masterKey is null", () => {
    vi.mocked(useMasterKey).mockReturnValueOnce(null);
    useSystemSettings();
    expect(lastSettingsQueryOpts["enabled"]).toBe(false);
  });

  it("select decrypts raw system settings correctly", () => {
    useSystemSettings();
    const select = lastSettingsQueryOpts["select"] as (raw: SystemSettingsRaw) => unknown;
    const raw = makeRawSystemSettings();
    const result = select(raw) as Record<string, unknown>;
    expect(result["theme"]).toBe("dark");
    expect(result["id"]).toBe(SETTINGS_ID);
    expect(result["systemId"]).toBe(TEST_SYSTEM_ID);
  });
});

describe("useNomenclature", () => {
  it("enables when masterKey is present", () => {
    useNomenclature();
    expect(lastNomenclatureQueryOpts["enabled"]).toBe(true);
  });

  it("disables when masterKey is null", () => {
    vi.mocked(useMasterKey).mockReturnValueOnce(null);
    useNomenclature();
    expect(lastNomenclatureQueryOpts["enabled"]).toBe(false);
  });

  it("select decrypts raw nomenclature correctly", () => {
    useNomenclature();
    const select = lastNomenclatureQueryOpts["select"] as (raw: NomenclatureSettingsRaw) => unknown;
    const raw = makeRawNomenclature();
    const result = select(raw) as Record<string, unknown>;
    expect(result["collective"]).toBe("System");
    expect(result["individual"]).toBe("Member");
    expect(result["version"]).toBe(1);
  });
});

describe("useUpdateSettings", () => {
  it("invalidates settings get on success", () => {
    mockUtils.systemSettings.settings.get.invalidate.mockClear();
    useUpdateSettings();
    const onSuccess = lastUpdateSettingsOpts["onSuccess"] as () => void;
    onSuccess();
    expect(mockUtils.systemSettings.settings.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useUpdateNomenclature", () => {
  it("invalidates nomenclature get on success", () => {
    mockUtils.systemSettings.nomenclature.get.invalidate.mockClear();
    useUpdateNomenclature();
    const onSuccess = lastUpdateNomenclatureOpts["onSuccess"] as () => void;
    onSuccess();
    expect(mockUtils.systemSettings.nomenclature.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useSetPin", () => {
  it("returns a mutation object", () => {
    const result = useSetPin();
    expect(result).toHaveProperty("mutate");
    // Pin mutations have no onSuccess invalidation
    expect(lastSetPinOpts).toEqual({});
  });
});

describe("useRemovePin", () => {
  it("returns a mutation object", () => {
    const result = useRemovePin();
    expect(result).toHaveProperty("mutate");
    expect(lastRemovePinOpts).toEqual({});
  });
});

describe("useVerifyPin", () => {
  it("returns a mutation object", () => {
    const result = useVerifyPin();
    expect(result).toHaveProperty("mutate");
    expect(lastVerifyPinOpts).toEqual({});
  });
});
