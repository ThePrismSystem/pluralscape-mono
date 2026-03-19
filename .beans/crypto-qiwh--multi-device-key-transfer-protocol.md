---
# crypto-qiwh
title: Multi-device key transfer protocol
status: completed
type: task
priority: normal
created_at: 2026-03-08T19:56:58Z
updated_at: 2026-03-15T07:53:48Z
parent: crypto-89v7
blocked_by:
  - crypto-l3hj
blocking:
  - crypto-og5h
---

Design and implement the multi-device key transfer protocol for transferring MasterKey between devices.

## Scope

- Transfer initiation: new device displays QR code or numeric verification code
- Code verification: existing device confirms matching code (prevents MITM)
- One-time key derivation from shared verification code
- MasterKey encryption with one-time key for transit
- Encrypted transfer via server relay (server sees only ciphertext)
- New device decrypts MasterKey, user sets new password, MasterKey re-encrypted
- Session validation: existing device must have active authenticated session
- Transfer timeout: codes expire after configurable duration (default 5 minutes)
- Rate limiting: prevent brute-force code guessing

## Acceptance Criteria

- [ ] QR code and numeric code generation for transfer initiation
- [ ] Verification code matching between devices
- [ ] One-time key derivation from shared code
- [ ] MasterKey encrypted for transit (never plaintext on server)
- [ ] Server relay passes only ciphertext
- [ ] Transfer timeout and expiration
- [ ] Rate limiting on code verification attempts
- [ ] Unit tests for key derivation and encryption
- [ ] Integration test: full transfer flow between two clients

## References

- ADR 011 (Key Recovery — Path 2: Multi-device transfer)
- ADR 006 (Encryption)

## Summary of Changes\n\nImplemented device transfer protocol crypto primitives:\n- New `device-transfer.ts`: code generation, Argon2id key derivation, encrypt/decrypt, QR encoding\n- Added auth.device-transfer-initiated and auth.device-transfer-completed audit event types\n- 22 tests covering code generation, key derivation, encrypt/decrypt, QR round-trip, validation
