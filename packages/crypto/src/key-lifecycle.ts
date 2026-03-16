import { decryptBucketKey } from "./bucket-keys.js";
import { AEAD_NONCE_BYTES } from "./crypto.constants.js";
import { InvalidStateTransitionError, KeysLockedError } from "./errors.js";
import { deriveMasterKey } from "./master-key.js";
import { assertKdfMasterKey, validateKeyVersion } from "./validation.js";

import type { WrappedBucketKey } from "./bucket-keys.js";
import type { IdentityKeypair } from "./identity.js";
import type {
  KeyLifecycleConfig,
  KeyLifecycleDeps,
  KeyLifecycleManager,
  KeyLifecycleState,
  SecurityPresetLevel,
  TimerHandle,
} from "./lifecycle-types.js";
import type {
  AeadKey,
  AeadNonce,
  BoxKeypair,
  KdfMasterKey,
  PwhashSalt,
  SignKeypair,
} from "./types.js";
import type { BucketId } from "@pluralscape/types";

/** Master key storage identifier in SecureKeyStorage. */
const MASTER_KEY_STORAGE_ID = "master-key";

/** Security preset configurations. */
export const SECURITY_PRESETS: Readonly<Record<SecurityPresetLevel, KeyLifecycleConfig>> = {
  convenience: {
    inactivityTimeoutMs: 1_800_000, // 30 minutes
    graceTimeoutMs: 300_000, // 5 minutes
    requireBiometric: false,
  },
  standard: {
    inactivityTimeoutMs: 300_000, // 5 minutes
    graceTimeoutMs: 60_000, // 60 seconds
    requireBiometric: true,
  },
  paranoid: {
    inactivityTimeoutMs: 60_000, // 1 minute
    graceTimeoutMs: 0, // immediate lock on background
    requireBiometric: true,
  },
};

/**
 * Mobile key lifecycle state machine.
 *
 * Manages the unlock → inactivity → grace → lock cycle for mobile apps.
 * All key material is zeroed in a specific order when transitioning to locked:
 * onBeforeLock → bucketKeyCache → identity secret keys → masterKey.
 */
export class MobileKeyLifecycleManager implements KeyLifecycleManager {
  private readonly deps: KeyLifecycleDeps;
  private currentState: KeyLifecycleState = "terminated";
  private masterKey: KdfMasterKey | null = null;
  private identityKeys: IdentityKeypair | null = null;
  private inactivityTimer: TimerHandle | null = null;
  private graceTimer: TimerHandle | null = null;

  constructor(deps: KeyLifecycleDeps) {
    this.deps = deps;
  }

  get state(): KeyLifecycleState {
    return this.currentState;
  }

  // ── Unlock ──────────────────────────────────────────────────────────

  async unlockWithPassword(password: string, salt: PwhashSalt): Promise<void> {
    this.assertUnlockable();

    const masterKey = await deriveMasterKey(password, salt, "mobile");
    const identityKeys = this.deps.deriveIdentityKeys(masterKey);

    try {
      await this.deps.storage.store(MASTER_KEY_STORAGE_ID, masterKey, {
        requireBiometric: this.deps.config.requireBiometric,
        accessibility: "afterFirstUnlock",
      });
    } catch (error: unknown) {
      this.deps.sodium.memzero(identityKeys.signing.secretKey);
      this.deps.sodium.memzero(identityKeys.encryption.secretKey);
      this.deps.sodium.memzero(masterKey);
      throw error;
    }

    this.masterKey = masterKey;
    this.identityKeys = identityKeys;
    this.currentState = "unlocked";
    this.startInactivityTimer();
  }

  async unlockWithBiometric(): Promise<void> {
    if (this.currentState !== "locked") {
      throw new InvalidStateTransitionError(this.currentState, "unlocked");
    }

    const stored = await this.deps.storage.retrieve(MASTER_KEY_STORAGE_ID);
    if (stored === null) {
      throw new KeysLockedError("Biometric unlock failed: no master key in secure storage.");
    }

    assertKdfMasterKey(stored);

    let identityKeys: IdentityKeypair;
    try {
      identityKeys = this.deps.deriveIdentityKeys(stored);
    } catch (error: unknown) {
      this.deps.sodium.memzero(stored);
      throw error;
    }

    this.masterKey = stored;
    this.identityKeys = identityKeys;
    this.currentState = "unlocked";
    this.startInactivityTimer();
  }

  // ── Lock ────────────────────────────────────────────────────────────

  async lock(): Promise<void> {
    if (this.currentState === "locked" || this.currentState === "terminated") {
      return;
    }

    const onBeforeLockError = await this.teardownKeys();
    this.currentState = "locked";
    if (onBeforeLockError !== undefined) {
      throw onBeforeLockError;
    }
  }

  async logout(): Promise<void> {
    const onBeforeLockError = await this.teardownKeys();

    let storageError: Error | undefined;
    try {
      await this.deps.storage.clearAll();
    } catch (error: unknown) {
      storageError = error instanceof Error ? error : new Error(String(error));
    }

    this.currentState = "terminated";

    if (storageError !== undefined) {
      if (onBeforeLockError !== undefined) {
        throw new Error("logout failed: storage.clearAll() and onBeforeLock both threw", {
          cause: onBeforeLockError,
        });
      }
      throw storageError;
    }
    if (onBeforeLockError !== undefined) {
      throw onBeforeLockError;
    }
  }

  // ── Background / foreground ─────────────────────────────────────────

  onBackground(): void {
    if (this.currentState !== "unlocked") {
      return;
    }

    this.cancelInactivityTimer();
    this.currentState = "grace";
    this.graceTimer = this.deps.clock.setTimeout(() => {
      this.lock().catch((error: unknown) => {
        this.deps.onLockError?.(error instanceof Error ? error : new Error(String(error)));
      });
    }, this.deps.config.graceTimeoutMs);
  }

  onForeground(): void {
    if (this.currentState !== "grace") {
      return;
    }

    this.cancelGraceTimer();
    this.currentState = "unlocked";
    this.startInactivityTimer();
  }

  onUserActivity(): void {
    if (this.currentState !== "unlocked") {
      return;
    }

    this.startInactivityTimer();
  }

  // ── Key getters ─────────────────────────────────────────────────────

  getMasterKey(): KdfMasterKey {
    if (this.masterKey === null) {
      throw new KeysLockedError();
    }
    return this.masterKey;
  }

  getIdentityKeys(): { readonly sign: SignKeypair; readonly box: BoxKeypair } {
    if (this.identityKeys === null) {
      throw new KeysLockedError();
    }
    return { sign: this.identityKeys.signing, box: this.identityKeys.encryption };
  }

  getBucketKey(bucketId: BucketId, encryptedKey: Uint8Array, keyVersion: number): AeadKey {
    if (this.masterKey === null) {
      throw new KeysLockedError();
    }

    const cached = this.deps.bucketKeyCache.get(bucketId);
    if (cached !== undefined) {
      return cached;
    }

    // Split encryptedKey into nonce (first 24 bytes) + ciphertext (rest)
    const nonce = encryptedKey.slice(0, AEAD_NONCE_BYTES) as AeadNonce;
    const ciphertext = encryptedKey.slice(AEAD_NONCE_BYTES);

    const wrapped: WrappedBucketKey = {
      ciphertext,
      nonce,
      keyVersion: validateKeyVersion(keyVersion),
    };
    const decrypted = decryptBucketKey(wrapped, this.masterKey);

    this.deps.bucketKeyCache.set(bucketId, decrypted);
    return decrypted;
  }

  // ── Private helpers ─────────────────────────────────────────────────

  private assertUnlockable(): void {
    if (this.currentState !== "terminated" && this.currentState !== "locked") {
      throw new InvalidStateTransitionError(this.currentState, "unlocked");
    }
  }

  /**
   * Cancel timers, run onBeforeLock, clear all key material.
   * Returns the onBeforeLock error (if any) for the caller to re-throw
   * after completing its state transition.
   */
  private async teardownKeys(): Promise<Error | undefined> {
    this.cancelInactivityTimer();
    this.cancelGraceTimer();

    let onBeforeLockError: Error | undefined;
    try {
      await this.deps.onBeforeLock?.();
    } catch (error: unknown) {
      onBeforeLockError = error instanceof Error ? error : new Error(String(error));
    }

    this.clearKeyMaterial();
    return onBeforeLockError;
  }

  /**
   * Clear all key material in the correct order:
   * 1. bucketKeyCache.clearAll()
   * 2. memzero identity sign secret key
   * 3. memzero identity box secret key
   * 4. memzero masterKey
   * 5. null references
   */
  private clearKeyMaterial(): void {
    this.deps.bucketKeyCache.clearAll();

    if (this.identityKeys !== null) {
      this.deps.sodium.memzero(this.identityKeys.signing.secretKey);
      this.deps.sodium.memzero(this.identityKeys.encryption.secretKey);
      this.identityKeys = null;
    }

    if (this.masterKey !== null) {
      this.deps.sodium.memzero(this.masterKey);
      this.masterKey = null;
    }
  }

  private startInactivityTimer(): void {
    this.cancelInactivityTimer();
    this.inactivityTimer = this.deps.clock.setTimeout(() => {
      this.lock().catch((error: unknown) => {
        this.deps.onLockError?.(error instanceof Error ? error : new Error(String(error)));
      });
    }, this.deps.config.inactivityTimeoutMs);
  }

  private cancelInactivityTimer(): void {
    if (this.inactivityTimer !== null) {
      this.deps.clock.clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  private cancelGraceTimer(): void {
    if (this.graceTimer !== null) {
      this.deps.clock.clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }
  }
}
