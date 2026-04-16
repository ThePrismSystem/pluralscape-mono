import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { deriveAuthAndPasswordKeys } from "../auth-key.js";
import { createBucketKeyCache } from "../bucket-key-cache.js";
import { encryptBucketKey, generateBucketKey } from "../bucket-keys.js";
import { DecryptionFailedError, InvalidStateTransitionError, KeysLockedError } from "../errors.js";
import { generateIdentityKeypair } from "../identity.js";
import { MobileKeyLifecycleManager, SECURITY_PRESETS } from "../key-lifecycle.js";
import { generateMasterKey, wrapMasterKey } from "../master-key-wrap.js";
import { generateSalt } from "../master-key.js";
import { getSodium } from "../sodium.js";
import { createWebKeyStorage } from "../web-key-storage.js";

import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

import type { KeyLifecycleConfig, KeyLifecycleDeps } from "../lifecycle-types.js";
import type { EncryptedPayload } from "../symmetric.js";
import type { PwhashSalt } from "../types.js";
import type { BucketId } from "@pluralscape/types";

// Timer type declarations for test environment (lib: ES2022 excludes DOM/Node timer globals)
declare function setTimeout(callback: () => void, ms: number): number;
declare function clearTimeout(handle: number): void;

// ── Test helpers ────────────────────────────────────────────────────

beforeAll(setupSodium);
afterAll(teardownSodium);

const STANDARD_CONFIG: KeyLifecycleConfig = {
  inactivityTimeoutMs: 300_000, // 5min
  graceTimeoutMs: 60_000, // 60sec
  requireBiometric: true,
};

const TEST_PASSWORD = "test-passw0rd!";

/** Create an encrypted master key blob for use with unlockWithPassword. */
async function createWrappedMasterKey(
  password: string,
  salt: PwhashSalt,
): Promise<EncryptedPayload> {
  const masterKey = generateMasterKey();
  const passwordBytes = new TextEncoder().encode(password);
  const { passwordKey } = await deriveAuthAndPasswordKeys(passwordBytes, salt);
  const wrapped = wrapMasterKey(masterKey, passwordKey);
  getSodium().memzero(passwordKey);
  return wrapped;
}

function makeDeps(overrides?: Partial<KeyLifecycleDeps>): KeyLifecycleDeps {
  return {
    storage: createWebKeyStorage(),
    bucketKeyCache: createBucketKeyCache(),
    sodium: getSodium(),
    config: STANDARD_CONFIG,
    clock: {
      setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms),
      clearTimeout: (handle: number | object) => {
        clearTimeout(handle as number);
      },
    },
    deriveIdentityKeys: generateIdentityKeypair,
    ...overrides,
  };
}

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
    expect(() => manager.getBucketKey("bucket-1" as BucketId, new Uint8Array(64), 1)).toThrow(
      KeysLockedError,
    );
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

// ── 4. Lock + clearing protocol ─────────────────────────────────────

describe("lock", () => {
  it("transitions from unlocked to locked", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    await manager.lock();
    expect(manager.state).toBe("locked");
  });

  it("clears keys — getMasterKey throws after lock", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    await manager.lock();
    expect(() => manager.getMasterKey()).toThrow(KeysLockedError);
  });

  it("clears keys — getIdentityKeys throws after lock", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    await manager.lock();
    expect(() => manager.getIdentityKeys()).toThrow(KeysLockedError);
  });

  it("calls bucketKeyCache.clearAll()", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    const clearSpy = vi.spyOn(deps.bucketKeyCache, "clearAll");
    await manager.lock();
    expect(clearSpy).toHaveBeenCalled();
  });

  it("calls sodium.memzero on identity keys and masterKey", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    const memzeroSpy = vi.spyOn(deps.sodium, "memzero");
    await manager.lock();
    // Should memzero: identity sign SK, identity box SK, masterKey (at least 3 calls)
    expect(memzeroSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("is idempotent from locked state", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    await manager.lock();
    await expect(manager.lock()).resolves.toBeUndefined();
    expect(manager.state).toBe("locked");
  });

  it("is idempotent from terminated state", async () => {
    await expect(manager.lock()).resolves.toBeUndefined();
    expect(manager.state).toBe("terminated");
  });

  it("calls onBeforeLock callback", async () => {
    const onBeforeLock = vi.fn().mockResolvedValue(undefined);
    const depsWithCallback = makeDeps({ onBeforeLock });
    const m = new MobileKeyLifecycleManager(depsWithCallback);
    await m.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    await m.lock();
    expect(onBeforeLock).toHaveBeenCalledTimes(1);
  });

  it("re-throws onBeforeLock error after clearing keys on lock", async () => {
    const lockError = new Error("SQLCipher close failed");
    const onBeforeLock = vi.fn().mockRejectedValue(lockError);
    const depsWithCallback = makeDeps({ onBeforeLock });
    const m = new MobileKeyLifecycleManager(depsWithCallback);
    await m.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    await expect(m.lock()).rejects.toThrow(lockError);
    expect(m.state).toBe("locked");
    expect(() => m.getMasterKey()).toThrow(KeysLockedError);
  });

  it("re-throws onBeforeLock error after clearing keys on logout", async () => {
    const lockError = new Error("SQLCipher close failed");
    const onBeforeLock = vi.fn().mockRejectedValue(lockError);
    const depsWithCallback = makeDeps({ onBeforeLock });
    const m = new MobileKeyLifecycleManager(depsWithCallback);
    await m.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    await expect(m.logout()).rejects.toThrow(lockError);
    expect(m.state).toBe("terminated");
    expect(() => m.getMasterKey()).toThrow(KeysLockedError);
  });

  it("transitions from grace to locked", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    manager.onBackground();
    expect(manager.state).toBe("grace");
    await manager.lock();
    expect(manager.state).toBe("locked");
  });
});

// ── 5. Clearing order ───────────────────────────────────────────────

describe("clearing order", () => {
  it("clears in correct order: bucketKeyCache → identity keys → masterKey", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );

    // Capture buffer references before lock for identity-based matching
    const masterKeyRef = manager.getMasterKey();
    const identityKeys = manager.getIdentityKeys();
    const signSKRef = identityKeys.sign.secretKey;
    const boxSKRef = identityKeys.box.secretKey;

    const callOrder: string[] = [];
    vi.spyOn(deps.bucketKeyCache, "clearAll").mockImplementation(() => {
      callOrder.push("bucketKeyCache.clearAll");
    });
    const memzeroSpy = vi.spyOn(deps.sodium, "memzero").mockImplementation((buf: Uint8Array) => {
      if (buf === signSKRef) {
        callOrder.push("memzero:signSK");
      } else if (buf === boxSKRef) {
        callOrder.push("memzero:boxSK");
      } else if (buf === masterKeyRef) {
        callOrder.push("memzero:masterKey");
      }
    });

    await manager.lock();

    expect(callOrder).toEqual([
      "bucketKeyCache.clearAll",
      "memzero:signSK",
      "memzero:boxSK",
      "memzero:masterKey",
    ]);

    memzeroSpy.mockRestore();
  });
});

// ── 6. Grace period ─────────────────────────────────────────────────

describe("grace period", () => {
  it("onBackground transitions from unlocked to grace", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    manager.onBackground();
    expect(manager.state).toBe("grace");
  });

  it("onForeground transitions from grace back to unlocked", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    manager.onBackground();
    manager.onForeground();
    expect(manager.state).toBe("unlocked");
  });

  it("grace timer expiry triggers lock", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    manager.onBackground();
    expect(manager.state).toBe("grace");

    await vi.advanceTimersByTimeAsync(STANDARD_CONFIG.graceTimeoutMs);
    expect(manager.state).toBe("locked");
  });

  it("onForeground cancels grace timer", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    manager.onBackground();
    manager.onForeground();
    expect(manager.state).toBe("unlocked");

    // Advancing past grace timeout should not lock
    await vi.advanceTimersByTimeAsync(STANDARD_CONFIG.graceTimeoutMs + 1000);
    expect(manager.state).toBe("unlocked");
  });

  it("paranoid preset (graceTimeoutMs === 0) locks immediately on background", async () => {
    const paranoidConfig: KeyLifecycleConfig = {
      inactivityTimeoutMs: 60_000,
      graceTimeoutMs: 0,
      requireBiometric: true,
    };
    const paranoidDeps = makeDeps({ config: paranoidConfig });
    const m = new MobileKeyLifecycleManager(paranoidDeps);
    await m.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    m.onBackground();
    // With graceTimeoutMs=0, should lock immediately (async)
    await vi.advanceTimersByTimeAsync(0);
    expect(m.state).toBe("locked");
  });

  it("getMasterKey returns key during grace", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    manager.onBackground();
    expect(manager.state).toBe("grace");
    const key = manager.getMasterKey();
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key).toHaveLength(32);
  });

  it("getIdentityKeys returns keys during grace", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    manager.onBackground();
    expect(manager.state).toBe("grace");
    const keys = manager.getIdentityKeys();
    expect(keys.sign.publicKey).toBeInstanceOf(Uint8Array);
    expect(keys.box.publicKey).toBeInstanceOf(Uint8Array);
  });

  it("getBucketKey works during grace", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    const masterKey = manager.getMasterKey();
    const bucketKey = generateBucketKey();
    const wrapped = encryptBucketKey(bucketKey, masterKey, 1);
    const encryptedKey = new Uint8Array(wrapped.nonce.length + wrapped.ciphertext.length);
    encryptedKey.set(wrapped.nonce, 0);
    encryptedKey.set(wrapped.ciphertext, wrapped.nonce.length);

    manager.onBackground();
    expect(manager.state).toBe("grace");
    const result = manager.getBucketKey("bucket-grace" as BucketId, encryptedKey, 1);
    expect(result).toEqual(bucketKey);
  });

  it("onBackground is a no-op from locked", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    await manager.lock();
    manager.onBackground();
    expect(manager.state).toBe("locked");
  });

  it("onBackground is a no-op from terminated", () => {
    manager.onBackground();
    expect(manager.state).toBe("terminated");
  });

  it("onForeground is a no-op from unlocked", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    manager.onForeground();
    expect(manager.state).toBe("unlocked");
  });

  it("onForeground is a no-op from locked", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    await manager.lock();
    manager.onForeground();
    expect(manager.state).toBe("locked");
  });

  it("reaches locked state and calls onLockError when grace timer fires with failing onBeforeLock", async () => {
    const lockError = new Error("onBeforeLock failed in grace");
    const onBeforeLock = vi.fn().mockRejectedValue(lockError);
    const onLockError = vi.fn();
    const customDeps = makeDeps({ onBeforeLock, onLockError });
    const m = new MobileKeyLifecycleManager(customDeps);
    await m.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );

    m.onBackground();
    expect(m.state).toBe("grace");

    await vi.advanceTimersByTimeAsync(STANDARD_CONFIG.graceTimeoutMs);
    expect(m.state).toBe("locked");
    expect(onLockError).toHaveBeenCalledWith(lockError);
  });
});

// ── 7. Inactivity timer ─────────────────────────────────────────────

describe("inactivity timer", () => {
  it("locks after inactivity timeout", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    expect(manager.state).toBe("unlocked");

    await vi.advanceTimersByTimeAsync(STANDARD_CONFIG.inactivityTimeoutMs);
    expect(manager.state).toBe("locked");
  });

  it("onUserActivity resets the timer", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );

    // Advance most of the way
    await vi.advanceTimersByTimeAsync(STANDARD_CONFIG.inactivityTimeoutMs - 1000);
    expect(manager.state).toBe("unlocked");

    // Activity resets timer
    manager.onUserActivity();

    // Advance the remaining 1s — should NOT lock because timer was reset
    await vi.advanceTimersByTimeAsync(1000);
    expect(manager.state).toBe("unlocked");

    // Advance the full timeout — now it should lock
    await vi.advanceTimersByTimeAsync(STANDARD_CONFIG.inactivityTimeoutMs);
    expect(manager.state).toBe("locked");
  });

  it("restarts inactivity timer after foreground return", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    manager.onBackground();
    expect(manager.state).toBe("grace");
    manager.onForeground();
    expect(manager.state).toBe("unlocked");

    await vi.advanceTimersByTimeAsync(STANDARD_CONFIG.inactivityTimeoutMs);
    expect(manager.state).toBe("locked");
  });

  it("onUserActivity is a no-op from locked", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    await manager.lock();
    // Should not throw
    manager.onUserActivity();
    expect(manager.state).toBe("locked");
  });

  it("onUserActivity is a no-op from terminated", () => {
    manager.onUserActivity();
    expect(manager.state).toBe("terminated");
  });

  it("reaches locked state and calls onLockError when onBeforeLock throws", async () => {
    const lockError = new Error("onBeforeLock failed");
    const onBeforeLock = vi.fn().mockRejectedValue(lockError);
    const onLockError = vi.fn();
    const customDeps = makeDeps({ onBeforeLock, onLockError });
    const m = new MobileKeyLifecycleManager(customDeps);
    await m.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );

    await vi.advanceTimersByTimeAsync(STANDARD_CONFIG.inactivityTimeoutMs);
    expect(m.state).toBe("locked");
    expect(onLockError).toHaveBeenCalledWith(lockError);
  });
});

// ── 8. getBucketKey ─────────────────────────────────────────────────

describe("getBucketKey", () => {
  const bucketId = "bucket-test-001" as BucketId;

  it("decrypts and returns a bucket key", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    const masterKey = manager.getMasterKey();

    // Generate and wrap a bucket key
    const bucketKey = generateBucketKey();
    const wrapped = encryptBucketKey(bucketKey, masterKey, 1);

    // Combine nonce + ciphertext as the encryptedKey param
    const encryptedKey = new Uint8Array(wrapped.nonce.length + wrapped.ciphertext.length);
    encryptedKey.set(wrapped.nonce, 0);
    encryptedKey.set(wrapped.ciphertext, wrapped.nonce.length);

    const result = manager.getBucketKey(bucketId, encryptedKey, 1);
    expect(result).toEqual(bucketKey);
  });

  it("caches the bucket key on first access", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    const masterKey = manager.getMasterKey();

    const bucketKey = generateBucketKey();
    const wrapped = encryptBucketKey(bucketKey, masterKey, 1);
    const encryptedKey = new Uint8Array(wrapped.nonce.length + wrapped.ciphertext.length);
    encryptedKey.set(wrapped.nonce, 0);
    encryptedKey.set(wrapped.ciphertext, wrapped.nonce.length);

    // First call — should decrypt
    manager.getBucketKey(bucketId, encryptedKey, 1);
    expect(deps.bucketKeyCache.has(bucketId)).toBe(true);
  });

  it("returns cached key on second access without decrypting again", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    const masterKey = manager.getMasterKey();

    const bucketKey = generateBucketKey();
    const wrapped = encryptBucketKey(bucketKey, masterKey, 1);
    const encryptedKey = new Uint8Array(wrapped.nonce.length + wrapped.ciphertext.length);
    encryptedKey.set(wrapped.nonce, 0);
    encryptedKey.set(wrapped.ciphertext, wrapped.nonce.length);

    manager.getBucketKey(bucketId, encryptedKey, 1);

    // Spy on decryptBucketKey path (cache should skip it)
    const cacheSpy = vi.spyOn(deps.bucketKeyCache, "get");
    const result = manager.getBucketKey(bucketId, encryptedKey, 1);
    expect(cacheSpy).toHaveBeenCalled();
    expect(result).toEqual(bucketKey);
  });

  it("throws KeysLockedError when locked", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    await manager.lock();
    expect(() => manager.getBucketKey(bucketId, new Uint8Array(64), 1)).toThrow(KeysLockedError);
  });

  it("throws on truncated encrypted key data", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    // Too short to contain nonce (24 bytes) + any ciphertext
    const truncated = new Uint8Array(10);
    expect(() => manager.getBucketKey(bucketId, truncated, 1)).toThrow();
  });

  it("throws DecryptionFailedError on corrupted ciphertext", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    const masterKey = manager.getMasterKey();
    const bucketKey = generateBucketKey();
    const wrapped = encryptBucketKey(bucketKey, masterKey, 1);
    const encryptedKey = new Uint8Array(wrapped.nonce.length + wrapped.ciphertext.length);
    encryptedKey.set(wrapped.nonce, 0);
    encryptedKey.set(wrapped.ciphertext, wrapped.nonce.length);

    // Corrupt the ciphertext portion by filling it with zeros
    encryptedKey.fill(0, wrapped.nonce.length);

    expect(() => manager.getBucketKey("bucket-corrupt" as BucketId, encryptedKey, 1)).toThrow(
      DecryptionFailedError,
    );
  });
});

// ── 9. Logout ───────────────────────────────────────────────────────

describe("logout", () => {
  it("transitions to terminated state", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    await manager.logout();
    expect(manager.state).toBe("terminated");
  });

  it("clears secure storage", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    const clearSpy = vi.spyOn(deps.storage, "clearAll");
    await manager.logout();
    expect(clearSpy).toHaveBeenCalled();
  });

  it("clears all keys from memory", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    await manager.logout();
    expect(() => manager.getMasterKey()).toThrow(KeysLockedError);
    expect(() => manager.getIdentityKeys()).toThrow(KeysLockedError);
  });

  it("can unlock again after logout", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    await manager.logout();
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    expect(manager.state).toBe("unlocked");
  });

  it("logout from locked transitions to terminated", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    await manager.lock();
    expect(manager.state).toBe("locked");
    await manager.logout();
    expect(manager.state).toBe("terminated");
  });

  it("logout from terminated stays terminated", async () => {
    expect(manager.state).toBe("terminated");
    await manager.logout();
    expect(manager.state).toBe("terminated");
  });

  it("logout from grace transitions to terminated", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    manager.onBackground();
    expect(manager.state).toBe("grace");
    await manager.logout();
    expect(manager.state).toBe("terminated");
  });

  it("preserves both errors when onBeforeLock and storage.clearAll both throw", async () => {
    const beforeLockError = new Error("onBeforeLock failed");
    const storageError = new Error("storage.clearAll failed");
    const onBeforeLock = vi.fn().mockRejectedValue(beforeLockError);
    const customDeps = makeDeps({ onBeforeLock });
    vi.spyOn(customDeps.storage, "clearAll").mockRejectedValue(storageError);
    const m = new MobileKeyLifecycleManager(customDeps);
    await m.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );

    await expect(m.logout()).rejects.toSatisfy((error: Error) => {
      expect(error.message).toContain("storage.clearAll() and onBeforeLock both threw");
      expect(error.cause).toBe(beforeLockError);
      return true;
    });
    expect(m.state).toBe("terminated");
  });
});

// ── 10. Security presets ────────────────────────────────────────────

describe("SECURITY_PRESETS", () => {
  it("has convenience preset", () => {
    expect(SECURITY_PRESETS.convenience).toBeDefined();
    expect(SECURITY_PRESETS.convenience.inactivityTimeoutMs).toBe(1_800_000); // 30min
    expect(SECURITY_PRESETS.convenience.graceTimeoutMs).toBe(300_000); // 5min
    expect(SECURITY_PRESETS.convenience.requireBiometric).toBe(false);
  });

  it("has standard preset", () => {
    expect(SECURITY_PRESETS.standard).toBeDefined();
    expect(SECURITY_PRESETS.standard.inactivityTimeoutMs).toBe(300_000); // 5min
    expect(SECURITY_PRESETS.standard.graceTimeoutMs).toBe(60_000); // 60sec
    expect(SECURITY_PRESETS.standard.requireBiometric).toBe(true);
  });

  it("has paranoid preset", () => {
    expect(SECURITY_PRESETS.paranoid).toBeDefined();
    expect(SECURITY_PRESETS.paranoid.inactivityTimeoutMs).toBe(60_000); // 1min
    expect(SECURITY_PRESETS.paranoid.graceTimeoutMs).toBe(0);
    expect(SECURITY_PRESETS.paranoid.requireBiometric).toBe(true);
  });
});
