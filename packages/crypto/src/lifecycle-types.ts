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

  /** Get derived identity keypairs. Throws KeysLockedError if locked. */
  getIdentityKeys(): { readonly sign: SignKeypair; readonly box: BoxKeypair };

  /** Get or derive a bucket key. Throws KeysLockedError if locked. */
  getBucketKey(bucketId: BucketId, encryptedKey: Uint8Array, keyVersion: number): AeadKey;
}

/** Interface for platform-native secure memory zeroing. */
export interface NativeMemzero {
  /** Securely zero a buffer, resistant to dead-store elimination. */
  memzero(buffer: Uint8Array): void;
}
