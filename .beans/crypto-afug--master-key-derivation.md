---
# crypto-afug
title: Master key derivation
status: todo
type: task
priority: high
created_at: 2026-03-08T13:33:55Z
updated_at: 2026-03-08T13:35:42Z
parent: crypto-gd8f
blocked_by:
  - crypto-d2tj
---

Master key derivation from password using Argon2id

## Scope

- `deriveMasterKey(password: string, salt: Uint8Array): Promise<MasterKey>`
- Argon2id parameters (platform-tuned):
  - Server/Desktop: 64 MiB memory, 3 iterations, 1 parallelism (~250ms)
  - Mobile: 32 MiB memory, 2 iterations, 1 parallelism (~250ms on target devices)
  - Always 2+ iterations for ASIC resistance
- `generateSalt(): Uint8Array` — random 16-byte salt
- `MasterKey` as branded opaque type (never exposed as raw bytes to consumers)
- Salt storage strategy: salt stored alongside account on server (T3, not secret)
- Performance benchmarking target: ~250ms on slowest target device

## Acceptance Criteria

- [ ] deriveMasterKey function with Argon2id
- [ ] Platform-appropriate parameter selection
- [ ] MasterKey is branded type (cannot use as raw Uint8Array)
- [ ] Salt generation helper
- [ ] Deterministic: same password + salt = same key
- [ ] Performance benchmark test (log derivation time)
- [ ] Unit test: roundtrip derive → use → derive again with same inputs

## Research Notes

- OWASP recommends 46 MiB / 1 iter minimum
- 64 MiB / 3 iter is above OWASP minimum for server
- Tune annually as hardware improves
- ADR 006 states 256 MiB — needs updating to match these OWASP-informed parameters (64 MiB server, 32 MiB mobile)

## References

- ADR 006 (Argon2id parameters)
- encryption-research.md section 4.2
