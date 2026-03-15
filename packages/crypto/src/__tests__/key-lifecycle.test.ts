import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createBucketKeyCache } from "../bucket-key-cache.js";
import { encryptBucketKey, generateBucketKey } from "../bucket-keys.js";
import { InvalidStateTransitionError, KeysLockedError } from "../errors.js";
import { generateIdentityKeypair } from "../identity.js";
import { MobileKeyLifecycleManager, SECURITY_PRESETS } from "../key-lifecycle.js";
import { generateSalt } from "../master-key.js";
import { getSodium } from "../sodium.js";
import { createWebKeyStorage } from "../web-key-storage.js";

import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

import type { KeyLifecycleConfig, KeyLifecycleDeps } from "../lifecycle-types.js";
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
let salt: Uint8Array;

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
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    expect(manager.state).toBe("unlocked");
  });

  it("transitions from locked to unlocked", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    await manager.lock();
    expect(manager.state).toBe("locked");
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    expect(manager.state).toBe("unlocked");
  });

  it("makes getMasterKey return a KdfMasterKey", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    const masterKey = manager.getMasterKey();
    expect(masterKey).toBeInstanceOf(Uint8Array);
    expect(masterKey).toHaveLength(32);
  });

  it("makes getIdentityKeys return sign and box keypairs", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    const keys = manager.getIdentityKeys();
    expect(keys.sign.publicKey).toBeInstanceOf(Uint8Array);
    expect(keys.sign.secretKey).toBeInstanceOf(Uint8Array);
    expect(keys.box.publicKey).toBeInstanceOf(Uint8Array);
    expect(keys.box.secretKey).toBeInstanceOf(Uint8Array);
  });

  it("stores masterKey in secure storage", async () => {
    const storageSpy = vi.spyOn(deps.storage, "store");
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    expect(storageSpy).toHaveBeenCalledWith(
      "master-key",
      expect.any(Uint8Array),
      expect.anything(),
    );
  });

  it("throws InvalidStateTransitionError from unlocked", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    await expect(manager.unlockWithPassword(TEST_PASSWORD, salt)).rejects.toThrow(
      InvalidStateTransitionError,
    );
  });

  it("throws InvalidStateTransitionError from grace", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    manager.onBackground();
    expect(manager.state).toBe("grace");
    await expect(manager.unlockWithPassword(TEST_PASSWORD, salt)).rejects.toThrow(
      InvalidStateTransitionError,
    );
  });
});

// ── 3. Biometric unlock ─────────────────────────────────────────────

describe("unlockWithBiometric", () => {
  it("transitions from locked to unlocked when storage has masterKey", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
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
    await freshManager.unlockWithPassword(TEST_PASSWORD, salt);
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
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    await expect(manager.unlockWithBiometric()).rejects.toThrow(InvalidStateTransitionError);
  });
});

// ── 4. Lock + clearing protocol ─────────────────────────────────────

describe("lock", () => {
  it("transitions from unlocked to locked", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    await manager.lock();
    expect(manager.state).toBe("locked");
  });

  it("clears keys — getMasterKey throws after lock", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    await manager.lock();
    expect(() => manager.getMasterKey()).toThrow(KeysLockedError);
  });

  it("clears keys — getIdentityKeys throws after lock", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    await manager.lock();
    expect(() => manager.getIdentityKeys()).toThrow(KeysLockedError);
  });

  it("calls bucketKeyCache.clearAll()", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    const clearSpy = vi.spyOn(deps.bucketKeyCache, "clearAll");
    await manager.lock();
    expect(clearSpy).toHaveBeenCalled();
  });

  it("calls sodium.memzero on identity keys and masterKey", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    const memzeroSpy = vi.spyOn(deps.sodium, "memzero");
    await manager.lock();
    // Should memzero: identity sign SK, identity box SK, masterKey (at least 3 calls)
    expect(memzeroSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("is idempotent from locked state", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
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
    await m.unlockWithPassword(TEST_PASSWORD, salt);
    await m.lock();
    expect(onBeforeLock).toHaveBeenCalledTimes(1);
  });

  it("clears keys even if onBeforeLock throws", async () => {
    const onBeforeLock = vi.fn().mockRejectedValue(new Error("SQLCipher close failed"));
    const depsWithCallback = makeDeps({ onBeforeLock });
    const m = new MobileKeyLifecycleManager(depsWithCallback);
    await m.unlockWithPassword(TEST_PASSWORD, salt);
    await m.lock();
    expect(m.state).toBe("locked");
    expect(() => m.getMasterKey()).toThrow(KeysLockedError);
  });

  it("transitions from grace to locked", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    manager.onBackground();
    expect(manager.state).toBe("grace");
    await manager.lock();
    expect(manager.state).toBe("locked");
  });
});

// ── 5. Clearing order ───────────────────────────────────────────────

describe("clearing order", () => {
  it("clears in correct order: bucketKeyCache → identity keys → masterKey", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);

    const callOrder: string[] = [];
    vi.spyOn(deps.bucketKeyCache, "clearAll").mockImplementation(() => {
      callOrder.push("bucketKeyCache.clearAll");
    });
    const memzeroSpy = vi.spyOn(deps.sodium, "memzero").mockImplementation((buf: Uint8Array) => {
      // MasterKey is 32 bytes, sign SK is 64, box SK is 32
      if (buf.length === 64) {
        callOrder.push("memzero:signSK");
      } else if (
        callOrder.includes("memzero:signSK") &&
        buf.length === 32 &&
        !callOrder.includes("memzero:boxSK")
      ) {
        callOrder.push("memzero:boxSK");
      } else if (buf.length === 32) {
        callOrder.push("memzero:masterKey");
      }
    });

    await manager.lock();

    expect(callOrder[0]).toBe("bucketKeyCache.clearAll");
    // Identity keys should be zeroed before masterKey
    const signIdx = callOrder.indexOf("memzero:signSK");
    const boxIdx = callOrder.indexOf("memzero:boxSK");
    const masterIdx = callOrder.indexOf("memzero:masterKey");
    expect(signIdx).toBeGreaterThan(-1);
    expect(boxIdx).toBeGreaterThan(-1);
    expect(masterIdx).toBeGreaterThan(-1);
    expect(signIdx).toBeLessThan(masterIdx);
    expect(boxIdx).toBeLessThan(masterIdx);

    memzeroSpy.mockRestore();
  });
});

// ── 6. Grace period ─────────────────────────────────────────────────

describe("grace period", () => {
  it("onBackground transitions from unlocked to grace", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    manager.onBackground();
    expect(manager.state).toBe("grace");
  });

  it("onForeground transitions from grace back to unlocked", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    manager.onBackground();
    manager.onForeground();
    expect(manager.state).toBe("unlocked");
  });

  it("grace timer expiry triggers lock", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    manager.onBackground();
    expect(manager.state).toBe("grace");

    await vi.advanceTimersByTimeAsync(STANDARD_CONFIG.graceTimeoutMs);
    expect(manager.state).toBe("locked");
  });

  it("onForeground cancels grace timer", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
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
    await m.unlockWithPassword(TEST_PASSWORD, salt);
    m.onBackground();
    // With graceTimeoutMs=0, should lock immediately (async)
    await vi.advanceTimersByTimeAsync(0);
    expect(m.state).toBe("locked");
  });

  it("onBackground is a no-op from locked", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    await manager.lock();
    manager.onBackground();
    expect(manager.state).toBe("locked");
  });

  it("onBackground is a no-op from terminated", () => {
    manager.onBackground();
    expect(manager.state).toBe("terminated");
  });

  it("onForeground is a no-op from unlocked", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    manager.onForeground();
    expect(manager.state).toBe("unlocked");
  });

  it("onForeground is a no-op from locked", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    await manager.lock();
    manager.onForeground();
    expect(manager.state).toBe("locked");
  });
});

// ── 7. Inactivity timer ─────────────────────────────────────────────

describe("inactivity timer", () => {
  it("locks after inactivity timeout", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    expect(manager.state).toBe("unlocked");

    await vi.advanceTimersByTimeAsync(STANDARD_CONFIG.inactivityTimeoutMs);
    expect(manager.state).toBe("locked");
  });

  it("onUserActivity resets the timer", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);

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

  it("onUserActivity is a no-op from locked", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    await manager.lock();
    // Should not throw
    manager.onUserActivity();
    expect(manager.state).toBe("locked");
  });

  it("onUserActivity is a no-op from terminated", () => {
    manager.onUserActivity();
    expect(manager.state).toBe("terminated");
  });
});

// ── 8. getBucketKey ─────────────────────────────────────────────────

describe("getBucketKey", () => {
  const bucketId = "bucket-test-001" as BucketId;

  it("decrypts and returns a bucket key", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
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
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
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
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
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
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    await manager.lock();
    expect(() => manager.getBucketKey(bucketId, new Uint8Array(64), 1)).toThrow(KeysLockedError);
  });
});

// ── 9. Logout ───────────────────────────────────────────────────────

describe("logout", () => {
  it("transitions to terminated state", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    await manager.logout();
    expect(manager.state).toBe("terminated");
  });

  it("clears secure storage", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    const clearSpy = vi.spyOn(deps.storage, "clearAll");
    await manager.logout();
    expect(clearSpy).toHaveBeenCalled();
  });

  it("clears all keys from memory", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    await manager.logout();
    expect(() => manager.getMasterKey()).toThrow(KeysLockedError);
    expect(() => manager.getIdentityKeys()).toThrow(KeysLockedError);
  });

  it("can unlock again after logout", async () => {
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    await manager.logout();
    await manager.unlockWithPassword(TEST_PASSWORD, salt);
    expect(manager.state).toBe("unlocked");
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
