import type { AeadKey, BoxKeypair, KdfMasterKey, SignKeypair } from "./types.js";
import type { BucketId } from "@pluralscape/types";

/** Lifecycle states for the mobile key manager. */
export type KeyLifecycleState = "terminated" | "locked" | "unlocked" | "grace";

/** Security preset levels for mobile lock configuration. */
export type SecurityPresetLevel = "convenience" | "standard" | "paranoid";

/** Primary interface for managing key state on mobile. */
export interface KeyLifecycleManager {
  /** Current lifecycle state. */
  readonly state: KeyLifecycleState;

  /** Derive MasterKey from password + salt, store in secure storage, transition to unlocked. */
  unlockWithPassword(password: string, salt: Uint8Array): Promise<void>;

  /** Retrieve MasterKey from secure storage via biometric, transition to unlocked. */
  unlockWithBiometric(): Promise<void>;

  /** Clear all keys from memory, transition to locked. */
  lock(): Promise<void>;

  /** Clear all keys from memory AND delete secure storage entries. */
  logout(): Promise<void>;

  /** Called when app moves to background. Starts grace timer. */
  onBackground(): void;

  /** Called when app returns to foreground. Cancels grace timer if running. */
  onForeground(): void;

  /** Called on user interaction. Resets inactivity timeout. */
  onUserActivity(): void;

  /** Get MasterKey. Throws KeysLockedError if state is not unlocked/grace. */
  getMasterKey(): KdfMasterKey;

  /** Get derived identity keypairs. Throws KeysLockedError if state is not unlocked/grace. */
  getIdentityKeys(): { readonly sign: SignKeypair; readonly box: BoxKeypair };

  /** Get or derive a bucket key. Throws KeysLockedError if state is not unlocked/grace. */
  getBucketKey(bucketId: BucketId, encryptedKey: Uint8Array, keyVersion: number): AeadKey;
}

/** Interface for platform-native secure memory zeroing. */
export interface NativeMemzero {
  /** Securely zero a buffer, resistant to dead-store elimination. */
  memzero(buffer: Uint8Array): void;
}

/** Abstraction over setTimeout/clearTimeout for testability. */
export interface Clock {
  setTimeout(callback: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

/**
 * Opaque timer handle returned by Clock.setTimeout, passed to Clock.clearTimeout.
 *
 * `number | object` is intentional: browser returns a number, Node returns an
 * opaque Timeout object. The handle is never inspected — it is only stored and
 * forwarded to clearTimeout, so a union of both shapes is correct.
 */
export type TimerHandle = number | object;

/** Configuration for key lifecycle timeouts. */
export interface KeyLifecycleConfig {
  /** Milliseconds of inactivity before auto-lock. */
  readonly inactivityTimeoutMs: number;
  /** Milliseconds of background grace before auto-lock. */
  readonly graceTimeoutMs: number;
  /** Whether biometric unlock is required. */
  readonly requireBiometric: boolean;
}

/** Dependencies injected into MobileKeyLifecycleManager. */
export interface KeyLifecycleDeps {
  readonly storage: import("./key-storage.js").SecureKeyStorage;
  readonly bucketKeyCache: import("./bucket-key-cache.js").BucketKeyCache;
  readonly sodium: import("./adapter/interface.js").SodiumAdapter;
  readonly config: KeyLifecycleConfig;
  readonly clock: Clock;
  readonly deriveIdentityKeys: (masterKey: KdfMasterKey) => import("./identity.js").IdentityKeypair;
  readonly onBeforeLock?: () => Promise<void>;
}
