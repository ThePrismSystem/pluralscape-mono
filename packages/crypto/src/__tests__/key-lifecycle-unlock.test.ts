import { brandId } from "@pluralscape/types";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { InvalidStateTransitionError, KeysLockedError } from "../errors.js";
import { generateIdentityKeypair } from "../identity.js";
import { MobileKeyLifecycleManager, SECURITY_PRESETS } from "../key-lifecycle.js";
import { generateSalt } from "../master-key.js";

import {
  KEY_VERSION_1,
  STANDARD_CONFIG,
  TEST_PASSWORD,
  createWrappedMasterKey,
  makeDeps,
} from "./helpers/key-lifecycle-fixtures.js";
import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

import type { KeyLifecycleDeps } from "../lifecycle-types.js";
import type { PwhashSalt } from "../types.js";
import type { BucketId } from "@pluralscape/types";

// Argon2id password derivation is CPU-bound. Under the full `pnpm test` run,
// multiple vitest projects fan out concurrently and contend for cores, which
// can push individual Argon2 operations past the global 5s testTimeout. Nearly
// every test in this file calls `createWrappedMasterKey` (which derives via
// Argon2id), so a file-level override is the narrowest fix. Isolated runs
// complete well under 5s; 30s is comfortably above worst-case contention.
vi.setConfig({ testTimeout: 30_000 });

beforeAll(setupSodium);
afterAll(teardownSodium);

let manager: MobileKeyLifecycleManager;
let deps: KeyLifecycleDeps;
let salt: PwhashSalt;

beforeEach(() => {
  vi.useFakeTimers();
  salt = generateSalt();
  deps = makeDeps();
  manager = new MobileKeyLifecycleManager(deps);
});

afterEach(() => {
  vi.useRealTimers();
});

// ── 1. Initial state ────────────────────────────────────────────────

describe("initial state", () => {
  it("starts in terminated state", () => {
    expect(manager.state).toBe("terminated");
  });

  it("getMasterKey throws KeysLockedError", () => {
    expect(() => manager.getMasterKey()).toThrow(KeysLockedError);
  });

  it("getIdentityKeys throws KeysLockedError", () => {
    expect(() => manager.getIdentityKeys()).toThrow(KeysLockedError);
  });

  it("getBucketKey throws KeysLockedError", () => {
    expect(() =>
      manager.getBucketKey(brandId<BucketId>("bucket-1"), new Uint8Array(64), KEY_VERSION_1),
    ).toThrow(KeysLockedError);
  });
});

// ── 2. Password unlock ──────────────────────────────────────────────

describe("unlockWithPassword", () => {
  it("transitions from terminated to unlocked", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    expect(manager.state).toBe("unlocked");
  });

  it("transitions from locked to unlocked", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    await manager.lock();
    expect(manager.state).toBe("locked");
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    expect(manager.state).toBe("unlocked");
  });

  it("makes getMasterKey return a KdfMasterKey", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    const masterKey = manager.getMasterKey();
    expect(masterKey).toBeInstanceOf(Uint8Array);
    expect(masterKey).toHaveLength(32);
  });

  it("makes getIdentityKeys return sign and box keypairs", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    const keys = manager.getIdentityKeys();
    expect(keys.sign.publicKey).toBeInstanceOf(Uint8Array);
    expect(keys.sign.secretKey).toBeInstanceOf(Uint8Array);
    expect(keys.box.publicKey).toBeInstanceOf(Uint8Array);
    expect(keys.box.secretKey).toBeInstanceOf(Uint8Array);
  });

  it("stores masterKey in secure storage", async () => {
    const storageSpy = vi.spyOn(deps.storage, "store");
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    expect(storageSpy).toHaveBeenCalledWith(
      "master-key",
      expect.any(Uint8Array),
      expect.anything(),
    );
  });

  it("throws InvalidStateTransitionError from unlocked", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    await expect(
      manager.unlockWithPassword(
        TEST_PASSWORD,
        salt,
        await createWrappedMasterKey(TEST_PASSWORD, salt),
      ),
    ).rejects.toThrow(InvalidStateTransitionError);
  });

  it("throws InvalidStateTransitionError from grace", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    manager.onBackground();
    expect(manager.state).toBe("grace");
    await expect(
      manager.unlockWithPassword(
        TEST_PASSWORD,
        salt,
        await createWrappedMasterKey(TEST_PASSWORD, salt),
      ),
    ).rejects.toThrow(InvalidStateTransitionError);
  });

  it("passes requireBiometric: true to storage.store", async () => {
    const storageSpy = vi.spyOn(deps.storage, "store");
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    expect(storageSpy).toHaveBeenCalledWith(
      "master-key",
      expect.any(Uint8Array),
      expect.objectContaining({ requireBiometric: true }),
    );
  });

  it("passes requireBiometric: false to storage.store when configured", async () => {
    const convenienceDeps = makeDeps({
      config: { ...STANDARD_CONFIG, requireBiometric: false },
    });
    const m = new MobileKeyLifecycleManager(convenienceDeps);
    const storageSpy = vi.spyOn(convenienceDeps.storage, "store");
    await m.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    expect(storageSpy).toHaveBeenCalledWith(
      "master-key",
      expect.any(Uint8Array),
      expect.objectContaining({ requireBiometric: false }),
    );
  });

  it("memzeros derived keys if storage.store fails", async () => {
    const storageError = new Error("SecureStore write failed");
    const failingDeps = makeDeps();
    vi.spyOn(failingDeps.storage, "store").mockRejectedValue(storageError);
    const memzeroSpy = vi.spyOn(failingDeps.sodium, "memzero");
    const m = new MobileKeyLifecycleManager(failingDeps);

    await expect(
      m.unlockWithPassword(TEST_PASSWORD, salt, await createWrappedMasterKey(TEST_PASSWORD, salt)),
    ).rejects.toThrow(storageError);
    // Should have memzeroed the derived keys (at least 3 calls: signSK, boxSK, masterKey)
    expect(memzeroSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(m.state).toBe("terminated");
  });
});

// ── 3. Biometric unlock ─────────────────────────────────────────────

describe("unlockWithBiometric", () => {
  it("transitions from locked to unlocked when storage has masterKey", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    await manager.lock();
    expect(manager.state).toBe("locked");
    await manager.unlockWithBiometric();
    expect(manager.state).toBe("unlocked");
  });

  it("throws KeysLockedError when storage returns null (fail-closed)", async () => {
    // Fresh manager with empty storage — no masterKey stored
    const freshDeps = makeDeps();
    const freshManager = new MobileKeyLifecycleManager(freshDeps);
    // Move to locked state first — unlock then lock
    await freshManager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    await freshManager.lock();
    // Clear storage to simulate missing key
    await freshDeps.storage.clearAll();
    await expect(freshManager.unlockWithBiometric()).rejects.toThrow(KeysLockedError);
    expect(freshManager.state).toBe("locked");
  });

  it("throws InvalidStateTransitionError from terminated", async () => {
    await expect(manager.unlockWithBiometric()).rejects.toThrow(InvalidStateTransitionError);
  });

  it("throws InvalidStateTransitionError from unlocked", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    await expect(manager.unlockWithBiometric()).rejects.toThrow(InvalidStateTransitionError);
  });

  it("throws InvalidStateTransitionError from grace", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    manager.onBackground();
    expect(manager.state).toBe("grace");
    await expect(manager.unlockWithBiometric()).rejects.toThrow(InvalidStateTransitionError);
  });

  it("memzeros stored key and stays locked if deriveIdentityKeys throws", async () => {
    const deriveError = new Error("derivation failed");
    const failOnSecondCall = vi
      .fn()
      .mockImplementationOnce(generateIdentityKeypair)
      .mockImplementationOnce(() => {
        throw deriveError;
      });
    const customDeps = makeDeps({ deriveIdentityKeys: failOnSecondCall });
    const m = new MobileKeyLifecycleManager(customDeps);
    const memzeroSpy = vi.spyOn(customDeps.sodium, "memzero");

    // First unlock succeeds, then lock
    await m.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    await m.lock();
    expect(m.state).toBe("locked");

    // Second unlock (biometric) should fail and stay locked
    await expect(m.unlockWithBiometric()).rejects.toThrow(deriveError);
    expect(m.state).toBe("locked");
    expect(() => m.getMasterKey()).toThrow(KeysLockedError);
    // memzero should have been called on the stored key
    expect(memzeroSpy).toHaveBeenCalled();
  });
});

// ── 10. Security presets ────────────────────────────────────────────

describe("SECURITY_PRESETS", () => {
  it("has convenience preset", () => {
    expect(SECURITY_PRESETS.convenience.inactivityTimeoutMs).toBe(1_800_000); // 30min
    expect(SECURITY_PRESETS.convenience.graceTimeoutMs).toBe(300_000); // 5min
    expect(SECURITY_PRESETS.convenience.requireBiometric).toBe(false);
  });

  it("has standard preset", () => {
    expect(SECURITY_PRESETS.standard.inactivityTimeoutMs).toBe(300_000); // 5min
    expect(SECURITY_PRESETS.standard.graceTimeoutMs).toBe(60_000); // 60sec
    expect(SECURITY_PRESETS.standard.requireBiometric).toBe(true);
  });

  it("has paranoid preset", () => {
    expect(SECURITY_PRESETS.paranoid.inactivityTimeoutMs).toBe(60_000); // 1min
    expect(SECURITY_PRESETS.paranoid.graceTimeoutMs).toBe(0);
    expect(SECURITY_PRESETS.paranoid.requireBiometric).toBe(true);
  });
});
