# ADR 024: Device Transfer Code Entropy Trade-off

## Status

Accepted

## Context

Device transfer allows a user to securely move their encryption keys to a new device by entering an 8-digit decimal code displayed on the source device. The code is used to derive a temporary symmetric key via Argon2id, which encrypts the master key for transit.

The 8-digit code provides approximately 26.5 bits of entropy (log2(10^8)). While this is below the typical threshold for cryptographic secrets, it operates within a constrained protocol with multiple compensating controls.

This trade-off has been flagged in security audits (CWE-330: Use of Insufficiently Random Values). This ADR formalizes the accepted risk and documents the rationale.

## Decision

We accept 8 decimal digits as the transfer code length, relying on the following mitigations to make the low entropy acceptable in practice:

### Why 8 digits

The transfer code must be manually transcribed between two devices (e.g., read from a phone screen and typed on a laptop). Longer codes significantly increase transcription errors and user frustration. Usability testing of similar protocols (e.g., Signal safety numbers, WhatsApp QR fallback codes) consistently shows that codes beyond 8 characters have sharply declining completion rates.

### Mitigations

1. **Argon2id key derivation**: The code is stretched through Argon2id using the mobile profile (2 iterations, 32 MiB memory). Each brute-force guess requires running the full KDF, making parallel attacks expensive.

2. **5-minute session timeout**: Transfer sessions expire after 300 seconds (`TRANSFER_TIMEOUT_MS`). The server destroys the encrypted payload after expiry. This hard window limits online attack time.

3. **Server-side attempt limiting**: The transfer relay enforces rate limiting on code submission attempts, preventing automated online enumeration.

4. **Ephemeral session**: The encrypted payload exists only for the duration of the transfer session. There is no persistent ciphertext for an attacker to capture and attack offline at leisure under normal operation.

### Threat analysis

**Online brute-force**: Infeasible. With Argon2id at ~250ms per attempt on mobile hardware, exhausting 10^8 codes would take approximately 289 days single-threaded. Server-side rate limiting further restricts attempt frequency to well below this.

**Offline brute-force**: Requires the attacker to capture both the encrypted payload and the Argon2id salt from the transfer session. On modern GPUs (e.g., 4x RTX 4090), the mobile Argon2id profile can be cracked in approximately 28 hours. However, this requires a MITM position on the relay during the 5-minute transfer window, which is a high-bar prerequisite.

### Future hardening options

If the threat model evolves, consider:

- Increase code length to 10-12 digits (tradeoff: higher transcription error rate)
- Use server KDF profile (3 iterations, 64 MiB) instead of mobile profile
- Add attempt limiting directly on the relay (currently only rate-limited)
- Implement QR code scanning as an alternative to manual entry (eliminates transcription entirely)
- Channel binding to prevent relay MITM

## Consequences

**Positive:**

- Users can complete device transfers quickly and reliably
- The protocol remains usable on low-end mobile devices
- Multiple defense layers make practical exploitation unlikely

**Negative:**

- A sufficiently motivated attacker with relay access could theoretically brute-force the code offline
- The security margin is thinner than typical cryptographic protocols, requiring ongoing monitoring of GPU/ASIC capabilities
- Any reduction in Argon2id parameters (e.g., for performance) would directly weaken the transfer code's effective security

## References

- CWE-330: Use of Insufficiently Random Values
- `packages/crypto/src/device-transfer.ts` (implementation)
- `packages/crypto/src/crypto.constants.ts` (KDF parameters)
