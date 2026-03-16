---
# crypto-gd8f
title: Encryption layer
status: completed
type: epic
priority: normal
created_at: 2026-03-08T12:15:46Z
updated_at: 2026-03-16T07:14:56Z
parent: ps-vtws
---

packages/crypto — libsodium wrappers, key derivation, per-bucket keys, three-tier encryption model (ADR 006)

## Summary of Changes\n\nAll data-layer encryption primitives complete: libsodium bindings (WASM + React Native adapters), master key derivation, symmetric encryption, identity keypairs, signatures, bucket key management, key grants, recovery key generation/backup/password-reset, multi-device key transfer, safety number verification, encryption tier helpers, key lifecycle manager, NativeMemzero JSI module, and lazy key rotation protocol design. Remaining rotation implementation tasks (api-koty, client-cdhw) moved to Milestone 2.
