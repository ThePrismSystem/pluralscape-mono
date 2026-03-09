# Mobile Key Lifecycle Specification

This document specifies how cryptographic key material is managed on mobile (React Native / Expo) clients. It covers derivation, storage, state transitions, clearing, and platform-specific mitigations.

Prerequisite reading: ADR 006 (encryption architecture), ADR 011 (key recovery), ADR 013 (API auth).

## Key Inventory

| Key               | Type            | Size     | Storage                                          | Sensitivity |
| ----------------- | --------------- | -------- | ------------------------------------------------ | ----------- |
| MasterKey         | `KdfMasterKey`  | 32B      | expo-secure-store + in-memory                    | Critical    |
| Identity Sign Key | `SignSecretKey` | 64B      | In-memory only (derived from MasterKey via KDF)  | Critical    |
| Identity Enc Key  | `BoxSecretKey`  | 32B      | In-memory only (derived from MasterKey via KDF)  | Critical    |
| Bucket Keys       | `AeadKey`       | 32B each | In-memory LRU cache (max 64)                     | High        |
| Device Auth Key   | per-device      | 32B      | expo-secure-store (no biometric gate)            | Medium      |
| SQLCipher DB Key  | derived         | 32B      | Passed to SQLCipher, JS copy cleared immediately | Critical    |

All key types are defined in `packages/crypto/src/types.ts`. Derivation uses the BLAKE2B-based KDF specified in ADR 006 addendum.

## MasterKey Derivation Events

The MasterKey is derived from the user's password exactly **once** during initial login. After that, it is retrieved from secure storage. There are only 4 scenarios where MasterKey derivation or recovery occurs:

1. **Initial login** — `Argon2id(password, salt)` with mobile parameters (32 MiB memory, 2 iterations — reduced from the desktop 256 MiB/3 iterations to accommodate mobile RAM constraints). Store result in expo-secure-store.
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

**Key identifiers**:

- `"com.pluralscape.masterkey"` — MasterKey
- `"com.pluralscape.deviceauth"` — Device authentication key

## App State Machine

```
TERMINATED ──cold start──▶ LOCKED ──biometric/password──▶ UNLOCKED
                              ▲                              │
                              │                    app → background
                         timeout/lock                        │
                              │                              ▼
                              └──── timer expires ◀──── GRACE
                                                    foreground ──▶ UNLOCKED
```

| State        | Keys in memory                                           | Transition trigger                                  |
| ------------ | -------------------------------------------------------- | --------------------------------------------------- |
| `terminated` | None (MasterKey persisted in secure store if logged in)  | Cold start → `locked`                               |
| `locked`     | None                                                     | Auth success → `unlocked`                           |
| `unlocked`   | MasterKey + derived identity keys + bucket key LRU cache | Background → `grace`                                |
| `grace`      | Keys still in memory, grace timer running                | Timer expires → `locked`; foregrounded → `unlocked` |

### Transition Rules

- **`terminated` → `locked`**: App process starts. No keys in memory. Lock screen displayed.
- **`locked` → `unlocked`**: User authenticates via biometric or password. Keys loaded/derived.
- **`unlocked` → `grace`**: App moves to background. Grace timer starts. Keys remain in memory.
- **`grace` → `unlocked`**: App returns to foreground before timer expires. Timer cancelled. No re-auth needed.
- **`grace` → `locked`**: Timer expires while backgrounded. Keys cleared from memory. On next foreground, lock screen displayed.
- **`unlocked` → `locked`**: Explicit lock action (user taps lock button) or inactivity timeout. Immediate key clearing.

## Key Clearing Protocol

When transitioning to `locked` state, keys are cleared in a specific order — derived keys first, MasterKey last:

1. Close the SQLCipher database connection
2. Clear bucket key LRU cache (memzero each entry)
3. Clear identity keypairs (memzero sign and box secret keys)
4. Clear MasterKey (memzero)
5. Set state to `locked`
6. Present lock screen overlay (prevents iOS app switcher from showing sensitive content)

## Timing Configuration

| Parameter                 | Default | Range     | Setting                                |
| ------------------------- | ------- | --------- | -------------------------------------- |
| Lock timeout (inactivity) | 5 min   | 1–30 min  | `AppLockConfig.lockTimeout`            |
| Background grace          | 60 sec  | 0–300 sec | `AppLockConfig.backgroundGraceSeconds` |

### Security Presets

| Level              | Lock Timeout | Background Grace                      | Biometric |
| ------------------ | ------------ | ------------------------------------- | --------- |
| Convenience        | 30 min       | 5 min                                 | Optional  |
| Standard (default) | 5 min        | 60 sec                                | Required  |
| Paranoid           | 1 min        | 0 sec (immediate clear on background) | Required  |

Presets are UX shortcuts that set the individual values. Users can also configure each value independently.

## The Memzero Problem

`ReactNativeSodiumAdapter` reports `supportsSecureMemzero = false` because `buffer.fill(0)` can be optimized away by Hermes's JIT compiler (dead-store elimination). This is a known limitation of JS runtimes for cryptographic operations.

### Mitigation Layers

1. **Minimize JS heap exposure**: keys live in expo-secure-store at rest. They are pulled into JS memory only for active crypto operations, then cleared.

2. **Native memzero path**: define a `NativeMemzero` interface. `ReactNativeSodiumAdapter` accepts an optional `NativeMemzero` implementation at construction time. When provided, `supportsSecureMemzero` flips to `true`. Implementation via a thin JSI native module wrapping libsodium's `sodium_memzero` or `volatile`-qualified zeroing.

   ```typescript
   interface NativeMemzero {
     /** Securely zero a buffer, resistant to dead-store elimination. */
     memzero(buffer: Uint8Array): void;
   }
   ```

3. **JS fallback**: overwrite with `crypto.getRandomValues(buffer)` (side-effectful — the RNG call defeats dead-store elimination) then `buffer.fill(0)`. This is stronger than `fill(0)` alone.

4. **Buffer reuse pool**: pre-allocated buffers for key operations reduce GC copy surface. Buffers are drawn from the pool, used, zeroed, and returned — reducing the number of copies the GC might scatter across the heap.

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

**Fail-closed invariant**: if `secureStorage.retrieve("com.pluralscape.masterkey")` returns `null` for any reason, require full password re-authentication. Never fall through to `unlocked` state without valid key material in memory.

## Jailbreak / Root Detection

**Warn but allow.** Show a security advisory explaining that hardware-backed key protection is degraded on jailbroken/rooted devices. Do not block usage — this aligns with the project's anti-gatekeeping value (users should not be locked out of their own data due to device modifications).

Log the advisory acknowledgment to the audit trail (`device.security.jailbreak_warning_shown`).

## Type Changes

### `AppLockConfig` (packages/types/src/settings.ts)

Add `backgroundGraceSeconds` to support the grace period between background and key clearing:

```typescript
interface AppLockConfig {
  readonly pinEnabled: boolean;
  readonly biometricEnabled: boolean;
  readonly lockTimeout: number; // minutes
  readonly backgroundGraceSeconds: number; // 0 = immediate clear on background
}
```

## Interface Definitions

### `KeyLifecycleManager`

Primary interface for managing key state on mobile. Implementations coordinate with expo-secure-store, the app state machine, and the crypto adapter.

```typescript
interface KeyLifecycleManager {
  /** Current lifecycle state. */
  readonly state: "terminated" | "locked" | "unlocked" | "grace";

  /** Derive MasterKey from password + salt, store in secure storage, transition to unlocked. */
  unlockWithPassword(password: string, salt: Uint8Array): Promise<void>;

  /** Retrieve MasterKey from secure storage via biometric, transition to unlocked. */
  unlockWithBiometric(): Promise<void>;

  /** Clear all keys from memory, transition to locked. */
  lock(): void;

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
  getIdentityKeys(): { sign: SignKeypair; box: BoxKeypair };

  /** Get or derive a bucket key. Throws KeysLockedError if locked. */
  getBucketKey(bucketId: string, encryptedKey: Uint8Array): AeadKey;
}
```

### Error Types

```typescript
/** Thrown when crypto operations are attempted while keys are cleared. */
class KeysLockedError extends Error {
  readonly name = "KeysLockedError";
}

/** Thrown when expo-secure-store operations fail. */
class KeyStorageFailedError extends Error {
  readonly name = "KeyStorageFailedError";
  readonly cause: unknown;
}

/** Thrown when biometric authentication fails after max retries. */
class BiometricFailedError extends Error {
  readonly name = "BiometricFailedError";
  readonly retriesExhausted: boolean;
}
```

## Cross-References

- **ADR 006** — encryption architecture, key hierarchy, Argon2id parameters
- **ADR 006 addendum** — independent KDF derivation for identity keypairs
- **ADR 011** — recovery key and multi-device key transfer
- **ADR 013** — API auth with crypto keys (device auth key role)
- **ADR 014** — lazy key rotation (bucket key cache must support dual-key window during rotation)
- `packages/crypto/src/adapter/react-native-adapter.ts` — `supportsSecureMemzero = false` limitation
- `packages/crypto/src/types.ts` — branded key types
- `packages/crypto/src/constants.ts` — Argon2id parameters
