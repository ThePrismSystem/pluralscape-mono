---
# sync-jr85
title: Encryption integration for sync
status: todo
type: task
priority: high
created_at: 2026-03-08T13:35:53Z
updated_at: 2026-03-08T13:36:05Z
parent: sync-xlhb
---

Integration of encryption layer with sync protocol (secsync-inspired)

## Scope

- CRDT documents encrypted before transmission to server
- Server stores/relays encrypted CRDT operations (cannot inspect or merge)
- Client workflow: decrypt → apply CRDT merge → re-encrypt
- Document key mapping:
  - System-scoped documents: encrypted with master key
  - Bucket-scoped documents: encrypted with bucket key
- Encrypted snapshot + encrypted updates pattern (secsync model)
- Server enforces monotonic ordering without reading content
- Key exchange: client proves key possession during sync handshake

## Acceptance Criteria

- [ ] Encryption/decryption integrated into sync send/receive
- [ ] Server never sees plaintext CRDT operations
- [ ] Document key mapping to master key or bucket key
- [ ] Snapshot + update encryption pattern
- [ ] Monotonic ordering enforced server-side
- [ ] Integration test: encrypted sync roundtrip

## Research Notes

- secsync is the reference architecture: XChaCha20-Poly1305 encrypted snapshots+updates through "dumb pipe" server
- Use encryption-key boundaries as document boundaries

## References

- ADR 005, ADR 006
- secsync architecture
