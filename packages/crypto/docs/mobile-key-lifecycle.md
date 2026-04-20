# Mobile Key Lifecycle Specification

This document specifies how cryptographic key material is managed on mobile (React Native / Expo) clients. It covers derivation, storage, state transitions, clearing, and platform-specific mitigations.

Prerequisite reading: ADR 006 (encryption architecture), ADR 011 (key recovery), ADR 013 (API auth).

## Key Inventory

| Key               | Type            | Size     | Storage                                                                                                   | Sensitivity |
| ----------------- | --------------- | -------- | --------------------------------------------------------------------------------------------------------- | ----------- |
| MasterKey         | `KdfMasterKey`  | 32B      | expo-secure-store + in-memory                                                                             | Critical    |
| Identity Sign Key | `SignSecretKey` | 64B      | In-memory only (derived from MasterKey via KDF)                                                           | Critical    |
| Identity Enc Key  | `BoxSecretKey`  | 32B      | In-memory only (derived from MasterKey via KDF)                                                           | Critical    |
| Bucket Keys       | `AeadKey`       | 32B each | In-memory LRU cache (configurable max, default unbounded; versioned store tracks old+new during rotation) | High        |
| Device Auth Key   | per-device      | 32B      | expo-secure-store (no biometric gate)                                                                     | Medium      |
| SQLCipher DB Key  | derived         | 32B      | Passed to SQLCipher, JS copy cleared immediately                                                          | Critical    |

All key types are defined in `packages/crypto/src/types.ts`. Derivation uses the BLAKE2B-based KDF specified in ADR 006 addendum.

The bucket key cache tracks `(bucketId, keyVersion)` tuples via two internal stores: a main store keyed by `bucketId` (LRU), and a versioned store keyed by `bucketId:vN` with a budget of `maxSize * 2` (also LRU). During key rotation (ADR 014), a bucket may have two active keys simultaneously. The `createBucketKeyCache` factory accepts a `maxSize` option; when omitted the cache is unbounded. Both stores use memzero on eviction.

## MasterKey Derivation Events

The MasterKey is derived from the user's password exactly **once** during initial login. After that, it is retrieved from secure storage. There are only 4 scenarios where MasterKey derivation or recovery occurs:

1. **Initial login** — `Argon2id(password, salt)` with the `ARGON2ID_PROFILE_MASTER_KEY` parameters (64 MiB memory, 4 iterations — see ADR 037). Store result in expo-secure-store.

**Parameter justification**: `ARGON2ID_PROFILE_MASTER_KEY` (64 MiB / 4 iterations) exceeds the OWASP high-memory recommendation for Argon2id and is used for every long-lived derivation: auth-key split derivation and PIN hashing. Device-transfer uses the lighter `ARGON2ID_PROFILE_TRANSFER` (32 MiB / 3 iterations) because the input is a one-shot code guarded by a 5-minute session. Both profiles are defined in `packages/crypto/src/crypto.constants.ts` and rationale lives in `docs/adr/037-argon2id-context-profiles.md`.

2. **Cold start with biometric** — Retrieve from expo-secure-store via biometric prompt. No derivation.
3. **Password change** — Re-wrap the same MasterKey under a new password-derived key. Update expo-secure-store entry. The MasterKey itself does not change.
4. **Recovery key restore** — Decrypt the MasterKey backup blob using the recovery key (ADR 011, Path 1). Set a new password, store in expo-secure-store.

After initial login, MasterKey is **never re-derived from password** during normal operation.

## Platform Storage Details

### expo-secure-store

expo-secure-store has a 2048-byte value limit, which is sufficient for 32-byte keys base64-encoded (44 characters).

| Platform | Backend                               | Protection                                     |
| -------- | ------------------------------------- | ---------------------------------------------- |
| iOS      | Keychain (`kSecClassGenericPassword`) | `WHEN_UNLOCKED_THIS_DEVICE_ONLY` accessibility |
| Android  | EncryptedSharedPreferences            | Backed by Android Keystore hardware            |

**Biometric gating**: enabled via `requireAuthentication: true` in expo-secure-store options. When set, the OS requires biometric verification before returning the stored value.

**Key identifiers** (application-layer, outside the crypto package abstraction):

- `"com.pluralscape.masterkey"` — MasterKey
- `"com.pluralscape.deviceauth"` — Device authentication key

The crypto package uses the abstract `SecureKeyStorage` interface (`packages/crypto/src/key-storage.ts`) with the string key `"master-key"` as the internal storage identifier.

## App State Machine

```
TERMINATED ──cold start──▶ LOCKED ──biometric/password──▶ UNLOCKED
     │                                                         │
     └──────── first login (password) ──────────────────────▶ │
                              ▲                    app → background
                              │                              │
                         timeout/lock                        ▼
                              └──── timer expires ◀──── GRACE
                                                    foreground ──▶ UNLOCKED
```

| State        | Keys in memory                                           | Transition trigger                                  |
| ------------ | -------------------------------------------------------- | --------------------------------------------------- |
| `terminated` | None (MasterKey persisted in secure store if logged in)  | Cold start → `locked`; first login → `unlocked`     |
| `locked`     | None                                                     | Auth success → `unlocked`                           |
| `unlocked`   | MasterKey + derived identity keys + bucket key LRU cache | Background → `grace`                                |
| `grace`      | Keys still in memory, grace timer running                | Timer expires → `locked`; foregrounded → `unlocked` |

### Transition Rules

- **`terminated` → `locked`**: App process starts. No keys in memory. Lock screen displayed.
- **`terminated` → `unlocked`**: First-ever login — `unlockWithPassword` is called from `terminated` state. Keys derived and stored.
- **`locked` → `unlocked`**: User authenticates via biometric or password. Keys loaded/derived.
- **`unlocked` → `grace`**: App moves to background. Inactivity timer is cancelled. Grace timer starts. Keys remain in memory.
- **`grace` → `unlocked`**: App returns to foreground before timer expires. Grace timer cancelled. Inactivity timer restarted. No re-auth needed.
- **`grace` → `locked`**: Timer expires while backgrounded. Keys cleared from memory. On next foreground, lock screen displayed.
- **`unlocked` → `locked`**: Explicit lock action (user taps lock button) or inactivity timeout. Immediate key clearing.

## Key Clearing Protocol

When transitioning to `locked` state, `teardownKeys()` runs in order:

1. Cancel inactivity and grace timers
2. Await `onBeforeLock()` callback (caller's hook — e.g., close SQLCipher connection, flush pending writes)
3. Call `bucketKeyCache.clearAll()` (memzeros all entries in both main and versioned stores)
4. Memzero identity sign secret key
5. Memzero identity box secret key
6. Memzero MasterKey
7. Null all key references
8. Set state to `locked`

The `onBeforeLock` error (if any) is captured, key clearing continues to completion, then the error is re-thrown after the state transition.

## Timing Configuration

The crypto package uses `KeyLifecycleConfig` (defined in `packages/crypto/src/lifecycle-types.ts`), which stores timeouts in milliseconds:

| Parameter                 | Default | Range     | Field                 |
| ------------------------- | ------- | --------- | --------------------- |
| Lock timeout (inactivity) | 5 min   | 1–30 min  | `inactivityTimeoutMs` |
| Background grace          | 60 sec  | 0–300 sec | `graceTimeoutMs`      |
| Biometric required        | true    | —         | `requireBiometric`    |

The user-facing settings type `AppLockConfig` in `packages/types/src/settings.ts` stores `lockTimeout` in minutes and `backgroundGraceSeconds` in seconds. The mobile app is responsible for converting these to milliseconds when constructing `KeyLifecycleConfig`.

### Security Presets

```typescript
type SecurityPresetLevel = "convenience" | "standard" | "paranoid";
```

Preset configurations are defined as `SECURITY_PRESETS` in `packages/crypto/src/key-lifecycle.ts`:

| Level              | `inactivityTimeoutMs` | `graceTimeoutMs` | `requireBiometric` |
| ------------------ | --------------------- | ---------------- | ------------------ |
| Convenience        | 1,800,000 (30 min)    | 300,000 (5 min)  | false              |
| Standard (default) | 300,000 (5 min)       | 60,000 (60 sec)  | true               |
| Paranoid           | 60,000 (1 min)        | 0 (immediate)    | true               |

Presets are UX shortcuts that set the individual values. Users can also configure each value independently.

### Privacy Overlay

The privacy overlay prevents the iOS app switcher from displaying sensitive content. It is managed independently from key clearing:

- **Presented** on `onBackground()` (when the app enters the grace period) — immediately, before any timer logic.
- **Dismissed** on `onForeground()` — after the app returns to foreground and the grace timer is cancelled.
- The overlay remains visible through the lock transition if the grace timer expires while backgrounded.
- On Android, `FLAG_SECURE` on the root activity serves the same purpose and is set unconditionally while the app holds key material.

## The Memzero Problem

`ReactNativeSodiumAdapter` reports `supportsSecureMemzero = false` (i.e., `nativeMemzero === undefined`) because `buffer.fill(0)` can be optimized away by Hermes's JIT compiler (dead-store elimination). This is a known limitation of JS runtimes for cryptographic operations.

### Mitigation Layers

1. **Minimize JS heap exposure**: keys live in expo-secure-store at rest. They are pulled into JS memory only for active crypto operations, then cleared.

2. **Native memzero path**: `NativeMemzero` is defined in `packages/crypto/src/lifecycle-types.ts`. `ReactNativeSodiumAdapter` accepts an optional `NativeMemzero` implementation at construction time. When provided, `supportsSecureMemzero` returns `true`. The `wrapNativeMemzero(fn)` factory in `packages/crypto/src/adapter/native-memzero.ts` converts a raw native function into a `NativeMemzero` instance, keeping the crypto package free of Expo/RN runtime dependencies.

   ```typescript
   interface NativeMemzero {
     /** Securely zero a buffer, resistant to dead-store elimination. */
     memzero(buffer: Uint8Array): void;
   }
   ```

   The native implementation wraps libsodium's `sodium_memzero` or a `volatile`-qualified zeroing loop (iOS `memset_s`, Android volatile loop).

3. **JS fallback**: `buffer.fill(0)`. This is the best-effort polyfill used when no `NativeMemzero` is provided.

4. **Buffer reuse pool** _(deferred — pending profiling data)_: pre-allocated buffers for key operations would reduce GC copy surface. Buffers drawn from a pool, used, zeroed, and returned would reduce the number of copies the GC might scatter across the heap. This optimization is deferred until profiling on target devices demonstrates measurable GC-related key exposure.

5. **Documented residual risk**: on platforms without native memzero, freed GC memory may contain key material until overwritten by subsequent allocations. Mitigated by:
   - Device full-disk encryption (FDE) on both iOS and Android
   - Short key exposure windows (grace timer + inactivity timeout)
   - App-level lock screen preventing casual access

## Biometric Authentication Flow

```
biometric available + enrolled?
  ├─ yes → prompt biometric
  │         ├─ success → retrieve MasterKey from secure store → UNLOCKED
  │         ├─ fail (attempt < 3) → retry biometric
  │         └─ fail (attempt ≥ 3) → fallback to password entry
  ├─ invalidated (new fingerprint enrolled) → secure store returns null
  │   → password entry → re-derive/re-store MasterKey
  ├─ not enrolled → password entry
  └─ hardware unavailable → password entry
```

**Fail-closed invariant**: if `storage.retrieve("master-key")` returns `null` for any reason, require full password re-authentication. `unlockWithBiometric()` throws `KeysLockedError` when the stored key is absent. Never fall through to `unlocked` state without valid key material in memory.

## Device Transfer

`packages/crypto/src/device-transfer.ts` implements the QR-based device transfer flow for moving a MasterKey to a new device without network exposure.

### Security Model

- Verification code: 10 decimal digits (~33.2 bits entropy)
- Protected by `ARGON2ID_PROFILE_TRANSFER` (32 MiB / 3 iterations, ADR 037) to slow brute force
- Transfer sessions expire after 5 minutes (`TRANSFER_TIMEOUT_MS = 300_000`)
- QR payload carries only `{ requestId, salt }`; the 10-digit verification code must be entered manually on the target device (crypto-5d49, 2026-04-20)

### Public API

| Function                                     | Description                                                                                  |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `generateTransferCode()`                     | Generate `{ verificationCode, codeSalt, requestId }`. Display code to user on source device. |
| `deriveTransferKey(code, salt, profile?)`    | Argon2id-derive symmetric key from code + salt. Both devices call this with same inputs.     |
| `encryptForTransfer(masterKey, transferKey)` | AEAD-encrypt MasterKey under transfer key. Memzeros `transferKey` on return.                 |
| `decryptFromTransfer(payload, transferKey)`  | AEAD-decrypt received blob back to `KdfMasterKey`. Memzeros `transferKey` on return.         |
| `encodeQRPayload(init)`                      | Serialize `TransferInitiation` to JSON string for QR embedding. Salt encoded as hex.         |
| `decodeQRPayload(data)`                      | Parse and validate QR JSON. Throws `InvalidInputError` on malformed input.                   |
| `isValidTransferCode(code)`                  | Type guard — returns true for exactly 10 decimal digits.                                     |

### Transfer Flow

```
Source device                         Target device
─────────────────────────────────────────────────────
generateTransferCode()
  → verificationCode, codeSalt, requestId
  → encodeQRPayload() → QR shown on screen

                          scan QR → decodeQRPayload()
                          deriveTransferKey(code, salt)
                          POST /transfer/{requestId}/request

deriveTransferKey(code, codeSalt)
encryptForTransfer(masterKey, transferKey)
POST /transfer/{requestId}/respond with encrypted blob

                          GET /transfer/{requestId}/payload
                          decryptFromTransfer(payload, transferKey)
                          → masterKey available on target device
```

## Jailbreak / Root Detection

**Warn but allow.** Show a security advisory explaining that hardware-backed key protection is degraded on jailbroken/rooted devices. Do not block usage — this aligns with the project's anti-gatekeeping value (users should not be locked out of their own data due to device modifications).

Log the advisory acknowledgment to the audit trail (`device.security.jailbreak_warning_shown`).

## Interface Definitions

### `KeyLifecycleManager`

Defined in `packages/crypto/src/lifecycle-types.ts`. The concrete implementation is `MobileKeyLifecycleManager` in `packages/crypto/src/key-lifecycle.ts`, constructed with a `KeyLifecycleDeps` object.

```typescript
type KeyLifecycleState = "terminated" | "locked" | "unlocked" | "grace";

interface KeyLifecycleManager {
  /** Current lifecycle state. */
  readonly state: KeyLifecycleState;

  /**
   * Derive MasterKey from password + salt using Argon2id (mobile profile),
   * store in secure storage, derive identity keys, transition to unlocked.
   * Valid from: terminated, locked.
   */
  unlockWithPassword(password: string, salt: PwhashSalt): Promise<void>;

  /**
   * Retrieve MasterKey from secure storage via biometric, derive identity keys,
   * transition to unlocked. Throws KeysLockedError if storage returns null.
   * Valid from: locked.
   */
  unlockWithBiometric(): Promise<void>;

  /** Clear all keys from memory, transition to locked. Runs onBeforeLock callback first. */
  lock(): Promise<void>;

  /** Clear all keys from memory AND delete secure storage entries. Transitions to terminated. */
  logout(): Promise<void>;

  /** Called when app moves to background. Cancels inactivity timer. Starts grace timer. */
  onBackground(): void;

  /** Called when app returns to foreground. Cancels grace timer. Restarts inactivity timer. */
  onForeground(): void;

  /** Called on user interaction. Resets inactivity timeout. */
  onUserActivity(): void;

  /** Get MasterKey. Throws KeysLockedError if masterKey is null (locked/terminated). */
  getMasterKey(): KdfMasterKey;

  /** Get derived identity keypairs. Throws KeysLockedError if identityKeys is null. */
  getIdentityKeys(): { readonly sign: SignKeypair; readonly box: BoxKeypair };

  /** Get or decrypt a bucket key (LRU-cached by bucketId). Throws KeysLockedError if locked. */
  getBucketKey(bucketId: BucketId, encryptedKey: Uint8Array, keyVersion: number): AeadKey;
}
```

`getBucketKey` splits `encryptedKey` at byte 24 (nonce | ciphertext boundary), decrypts via `decryptBucketKey`, and caches by `bucketId`.

### `KeyLifecycleDeps`

```typescript
interface KeyLifecycleDeps {
  readonly storage: SecureKeyStorage;
  readonly bucketKeyCache: BucketKeyCache;
  readonly sodium: SodiumAdapter;
  readonly config: KeyLifecycleConfig;
  readonly clock: Clock;
  readonly deriveIdentityKeys: (masterKey: KdfMasterKey) => IdentityKeypair;
  readonly onBeforeLock?: () => Promise<void>;
  readonly onLockError?: (err: Error) => void;
}
```

`onBeforeLock` is called during every lock transition (manual, timeout, or background expiry) before key material is cleared. Use it to close the SQLCipher database, flush pending writes, etc. `onLockError` is called when a timer-triggered lock fails (key material is already cleared at that point).

### Error Types

All error classes use `override readonly name` for `instanceof`-free narrowing, matching the convention in `packages/crypto/src/errors.ts`.

```typescript
/** Thrown when crypto operations are attempted while keys are cleared. */
class KeysLockedError extends Error {
  override readonly name = "KeysLockedError" as const;
  constructor(message?: string, options?: ErrorOptions);
}

/** Thrown when expo-secure-store operations fail. */
class KeyStorageFailedError extends Error {
  override readonly name = "KeyStorageFailedError" as const;
  constructor(message?: string, options?: ErrorOptions);
}

/** Thrown when an invalid key lifecycle state transition is attempted. */
class InvalidStateTransitionError extends Error {
  override readonly name = "InvalidStateTransitionError" as const;
  readonly from: KeyLifecycleState;
  readonly to: KeyLifecycleState;
  constructor(from: KeyLifecycleState, to: KeyLifecycleState, options?: ErrorOptions);
}

/** Thrown when biometric authentication fails after max retries. */
class BiometricFailedError extends Error {
  override readonly name = "BiometricFailedError" as const;
  readonly retriesExhausted: boolean;
  constructor(retriesExhausted: boolean, message?: string, options?: ErrorOptions);
}
```

## Cross-References

- **ADR 006** — encryption architecture, key hierarchy, Argon2id parameters
- **ADR 006 addendum** — independent KDF derivation for identity keypairs
- **ADR 011** — recovery key and multi-device key transfer
- **ADR 013** — API auth with crypto keys (device auth key role)
- **ADR 014** — lazy key rotation (bucket key cache must support dual-key window during rotation)
- `packages/crypto/src/adapter/react-native-adapter.ts` — `ReactNativeSodiumAdapter`, `supportsSecureMemzero` limitation
- `packages/crypto/src/adapter/native-memzero.ts` — `wrapNativeMemzero` factory
- `packages/crypto/src/lifecycle-types.ts` — `KeyLifecycleManager`, `KeyLifecycleConfig`, `NativeMemzero`, `KeyLifecycleDeps`
- `packages/crypto/src/key-lifecycle.ts` — `MobileKeyLifecycleManager`, `SECURITY_PRESETS`
- `packages/crypto/src/key-storage.ts` — `SecureKeyStorage` interface
- `packages/crypto/src/bucket-key-cache.ts` — `BucketKeyCache`, `createBucketKeyCache`
- `packages/crypto/src/master-key.ts` — `generateSalt`, `PwhashProfile`, `PROFILE_PARAMS`
- `packages/crypto/src/master-key-wrap.ts` — `derivePasswordKey`, `generateMasterKey`, `wrapMasterKey`, `unwrapMasterKey`
- `packages/crypto/src/identity.ts` — `generateIdentityKeypair`, `IdentityKeypair`
- `packages/crypto/src/bucket-keys.ts` — `encryptBucketKey`, `decryptBucketKey`, `rotateBucketKey`
- `packages/crypto/src/device-transfer.ts` — `generateTransferCode`, `deriveTransferKey`, transfer flow
- `packages/crypto/src/types.ts` — branded key types
- `packages/crypto/src/crypto.constants.ts` — Argon2id parameters
- `packages/types/src/settings.ts` — `AppLockConfig` (user-facing settings type)
