// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import {
  encryptNomenclatureUpdate,
  encryptSystemSettingsUpdate,
} from "@pluralscape/data/transforms/system-settings";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderHookWithProviders,
  TEST_MASTER_KEY,
  TEST_SYSTEM_ID,
} from "./helpers/render-hook-with-providers.js";

import type {
  NomenclatureSettingsRaw,
  SystemSettingsRaw,
} from "@pluralscape/data/transforms/system-settings";
import type { SystemSettingsId, UnixMillis } from "@pluralscape/types";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

// ── Fixture registry (accessible from vi.mock via hoisting) ──────────
const { fixtures } = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  return { fixtures: store };
});

// ── Mock utils for mutation invalidation tracking ────────────────────
const mockUtils = {
  systemSettings: {
    settings: { get: { invalidate: vi.fn() } },
    nomenclature: { get: { invalidate: vi.fn() } },
  },
};

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      systemSettings: {
        settings: {
          get: {
            useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
              rq.useQuery({
                queryKey: ["systemSettings.settings.get", input],
                queryFn: () => Promise.resolve(fixtures.get("systemSettings.settings.get")),
                enabled: opts.enabled as boolean | undefined,
                select: opts.select as ((d: unknown) => unknown) | undefined,
              }),
          },
          update: {
            useMutation: (opts: Record<string, unknown> = {}) =>
              rq.useMutation({
                mutationFn: () => Promise.resolve({}),
                onSuccess: opts.onSuccess as (() => void) | undefined,
              }),
          },
        },
        nomenclature: {
          get: {
            useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
              rq.useQuery({
                queryKey: ["systemSettings.nomenclature.get", input],
                queryFn: () => Promise.resolve(fixtures.get("systemSettings.nomenclature.get")),
                enabled: opts.enabled as boolean | undefined,
                select: opts.select as ((d: unknown) => unknown) | undefined,
              }),
          },
          update: {
            useMutation: (opts: Record<string, unknown> = {}) =>
              rq.useMutation({
                mutationFn: () => Promise.resolve({}),
                onSuccess: opts.onSuccess as (() => void) | undefined,
              }),
          },
        },
        pin: {
          set: {
            useMutation: (opts: Record<string, unknown> = {}) =>
              rq.useMutation({
                mutationFn: () => Promise.resolve({}),
                onSuccess: opts.onSuccess as (() => void) | undefined,
              }),
          },
          remove: {
            useMutation: (opts: Record<string, unknown> = {}) =>
              rq.useMutation({
                mutationFn: () => Promise.resolve({}),
                onSuccess: opts.onSuccess as (() => void) | undefined,
              }),
          },
          verify: {
            useMutation: (opts: Record<string, unknown> = {}) =>
              rq.useMutation({
                mutationFn: () => Promise.resolve({}),
                onSuccess: opts.onSuccess as (() => void) | undefined,
              }),
          },
        },
      },
      useUtils: () => mockUtils,
    },
  };
});

// Must import AFTER vi.mock
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

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ── Query tests ─────────────────────────────────────────────────────
describe("useSystemSettings", () => {
  it("returns decrypted system settings data", async () => {
    fixtures.set("systemSettings.settings.get", makeRawSystemSettings());
    const { result } = renderHookWithProviders(() => useSystemSettings());

    let data: Awaited<ReturnType<typeof useSystemSettings>>["data"] | undefined;
    await waitFor(() => {
      data = result.current.data;
      expect(data).toBeDefined();
    });
    expect(data?.theme).toBe("dark");
    expect(data?.id).toBe(SETTINGS_ID);
    expect(data?.systemId).toBe(TEST_SYSTEM_ID);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useSystemSettings(), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("systemSettings.settings.get", makeRawSystemSettings());
    const { result, rerender } = renderHookWithProviders(() => useSystemSettings());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useNomenclature", () => {
  it("returns decrypted nomenclature data", async () => {
    fixtures.set("systemSettings.nomenclature.get", makeRawNomenclature());
    const { result } = renderHookWithProviders(() => useNomenclature());

    let data: Awaited<ReturnType<typeof useNomenclature>>["data"] | undefined;
    await waitFor(() => {
      data = result.current.data;
      expect(data).toBeDefined();
    });
    expect(data).toMatchObject({ collective: "System", individual: "Member", version: 1 });
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useNomenclature(), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("systemSettings.nomenclature.get", makeRawNomenclature());
    const { result, rerender } = renderHookWithProviders(() => useNomenclature());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

// ── Mutation tests ──────────────────────────────────────────────────
describe("useUpdateSettings", () => {
  it("invalidates settings.get on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateSettings());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.systemSettings.settings.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useUpdateNomenclature", () => {
  it("invalidates nomenclature.get on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateNomenclature());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.systemSettings.nomenclature.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useSetPin", () => {
  it("returns a mutation with no onSuccess invalidation", async () => {
    const { result } = renderHookWithProviders(() => useSetPin());

    await act(() => result.current.mutateAsync({} as never));

    // Pin mutations have no onSuccess cache invalidation
    expect(mockUtils.systemSettings.settings.get.invalidate).not.toHaveBeenCalled();
    expect(mockUtils.systemSettings.nomenclature.get.invalidate).not.toHaveBeenCalled();
  });
});

describe("useRemovePin", () => {
  it("returns a mutation with no onSuccess invalidation", async () => {
    const { result } = renderHookWithProviders(() => useRemovePin());

    await act(() => result.current.mutateAsync({} as never));

    expect(mockUtils.systemSettings.settings.get.invalidate).not.toHaveBeenCalled();
    expect(mockUtils.systemSettings.nomenclature.get.invalidate).not.toHaveBeenCalled();
  });
});

describe("useVerifyPin", () => {
  it("returns a mutation with no onSuccess invalidation", async () => {
    const { result } = renderHookWithProviders(() => useVerifyPin());

    await act(() => result.current.mutateAsync({} as never));

    expect(mockUtils.systemSettings.settings.get.invalidate).not.toHaveBeenCalled();
    expect(mockUtils.systemSettings.nomenclature.get.invalidate).not.toHaveBeenCalled();
  });
});
