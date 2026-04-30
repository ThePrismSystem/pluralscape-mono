import { brandId } from "@pluralscape/types";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { encryptBucketKey, generateBucketKey } from "../bucket-keys.js";
import { DecryptionFailedError, KeysLockedError } from "../errors.js";
import { MobileKeyLifecycleManager } from "../key-lifecycle.js";
import { generateSalt } from "../master-key.js";

import {
  KEY_VERSION_1,
  TEST_PASSWORD,
  createWrappedMasterKey,
  makeDeps,
} from "./helpers/key-lifecycle-fixtures.js";
import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

import type { KeyLifecycleDeps } from "../lifecycle-types.js";
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

// ── 8. getBucketKey ─────────────────────────────────────────────────

describe("getBucketKey", () => {
  const bucketId = brandId<BucketId>("bucket-test-001");

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

    const result = manager.getBucketKey(bucketId, encryptedKey, KEY_VERSION_1);
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
    manager.getBucketKey(bucketId, encryptedKey, KEY_VERSION_1);
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

    manager.getBucketKey(bucketId, encryptedKey, KEY_VERSION_1);

    // Spy on decryptBucketKey path (cache should skip it)
    const cacheSpy = vi.spyOn(deps.bucketKeyCache, "get");
    const result = manager.getBucketKey(bucketId, encryptedKey, KEY_VERSION_1);
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
    expect(() => manager.getBucketKey(bucketId, new Uint8Array(64), KEY_VERSION_1)).toThrow(
      KeysLockedError,
    );
  });

  it("throws on truncated encrypted key data", async () => {
    await manager.unlockWithPassword(
      TEST_PASSWORD,
      salt,
      await createWrappedMasterKey(TEST_PASSWORD, salt),
    );
    // Too short to contain nonce (24 bytes) + any ciphertext
    const truncated = new Uint8Array(10);
    expect(() => manager.getBucketKey(bucketId, truncated, KEY_VERSION_1)).toThrow();
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

    expect(() =>
      manager.getBucketKey(brandId<BucketId>("bucket-corrupt"), encryptedKey, KEY_VERSION_1),
    ).toThrow(DecryptionFailedError);
  });
});
