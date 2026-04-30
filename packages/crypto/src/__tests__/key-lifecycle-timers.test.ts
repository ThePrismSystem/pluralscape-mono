import { brandId } from "@pluralscape/types";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { encryptBucketKey, generateBucketKey } from "../bucket-keys.js";
import { MobileKeyLifecycleManager } from "../key-lifecycle.js";
import { generateSalt } from "../master-key.js";

import {
  KEY_VERSION_1,
  STANDARD_CONFIG,
  TEST_PASSWORD,
  createWrappedMasterKey,
  makeDeps,
} from "./helpers/key-lifecycle-fixtures.js";
import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

import type { KeyLifecycleConfig, KeyLifecycleDeps } from "../lifecycle-types.js";
import type { PwhashSalt } from "../types.js";
import type { BucketId } from "@pluralscape/types";

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
    const result = manager.getBucketKey(
      brandId<BucketId>("bucket-grace"),
      encryptedKey,
      KEY_VERSION_1,
    );
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
