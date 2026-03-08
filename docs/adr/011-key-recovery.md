# ADR 011: Key Lifecycle and Recovery

## Status

Accepted

## Context

Pluralscape derives all encryption keys from the user's password via Argon2id (ADR 006). This creates a fundamental challenge: if the user forgets their password, the Master Key cannot be re-derived, and all encrypted data becomes permanently inaccessible. Unlike server-side encryption where an admin can reset access, E2E encryption means key loss = data loss.

The recovery mechanism must:

- Allow users to regain access to their encrypted data after password loss
- Not compromise the zero-knowledge guarantee (server must not hold plaintext keys)
- Work across mobile and web clients
- Be understandable by non-technical users (the target audience includes people in crisis states)
- Not depend on social trust networks (this user base has specific trust concerns)

Evaluated: recovery key, social recovery (Shamir's Secret Sharing), server-escrowed backup, security questions, email-based recovery.

## Decision

Two recovery paths for V1. No social recovery.

### Path 1: Recovery key

Generated at registration. A high-entropy random key (256-bit, encoded as a human-readable string like `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`) that can independently derive the Master Key.

1. During registration, the client generates a RecoveryKey alongside the password-derived MasterKey
2. The RecoveryKey is used to encrypt a copy of the MasterKey → stored on the server as an encrypted blob
3. The plaintext RecoveryKey is shown to the user exactly once with instructions to store it offline (print, write down, save to a password manager)
4. On password loss: user enters RecoveryKey → client decrypts the MasterKey blob → user sets a new password → MasterKey re-encrypted under new password
5. The RecoveryKey itself is never sent to or stored on the server in plaintext

### Path 2: Multi-device key transfer

If the user has another device still logged in, the new device can receive keys directly.

1. New device initiates a key transfer request (displays a QR code or numeric code)
2. Existing device confirms the request (user verifies the code matches)
3. Existing device encrypts the MasterKey with a one-time key derived from the shared code
4. Encrypted MasterKey transferred via the server (server sees only ciphertext)
5. New device decrypts → user sets a new password → MasterKey re-encrypted

### Password reset without recovery = new account

If the user has lost both their password and recovery key, and has no other logged-in devices:

- The server can reset the account credentials (new password)
- All existing encrypted data is permanently inaccessible
- The user starts fresh with an empty account
- The UI makes this consequence extremely clear during onboarding and at the recovery prompt

### What the setup wizard enforces

1. Recovery key is generated and displayed during registration
2. User must acknowledge they have saved the recovery key (checkbox + confirmation)
3. Periodic reminders if recovery key has never been used to verify it works
4. Recovery key can be regenerated from an authenticated session (old key revoked, new key issued)

### Why not social recovery

- **Shamir's Secret Sharing** splits the recovery key among N trusted contacts, requiring K-of-N to reconstruct
- This user base has specific trust concerns — many users have experienced abuse, and designating "trusted" people is fraught
- Implementation complexity is high (key share distribution, share refresh, contact management)
- Deferred to a future version if community demand exists

### Why not server escrow

- Breaks the zero-knowledge guarantee
- Server operator (including self-hosted) could access user data
- Fundamentally incompatible with the privacy model

## Consequences

- Users who lose both password and recovery key lose all data — this is the intended tradeoff for zero-knowledge encryption
- The recovery key UX is critical — if users skip or lose it, support burden increases. The onboarding flow must be designed to make saving the key feel important without being annoying
- Multi-device transfer requires at least one active session — does not help users who lose their only device
- Recovery key regeneration requires re-encrypting the MasterKey backup blob (cheap operation)
- Web sessions are stateless (MasterKey held in memory only, re-derived from password each session) — web cannot serve as a "backup device" for key transfer unless actively open

### License

No new dependencies. Uses existing libsodium primitives (ADR 006).
