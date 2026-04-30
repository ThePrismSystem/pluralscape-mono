import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { KeysLockedError } from "../errors.js";
import { MobileKeyLifecycleManager } from "../key-lifecycle.js";
import { generateSalt } from "../master-key.js";

import {
  TEST_PASSWORD,
  createWrappedMasterKey,
  makeDeps,
} from "./helpers/key-lifecycle-fixtures.js";
import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

import type { KeyLifecycleDeps } from "../lifecycle-types.js";
import type { PwhashSalt } from "../types.js";

// Argon2id password derivation is CPU-bound — same rationale as in
// key-lifecycle-unlock.test.ts. Keep tests above the global 5s testTimeout.
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
