---
# client-cde3
title: Encrypt PK API token client-side with master key
status: todo
type: task
priority: high
created_at: 2026-04-16T03:21:33Z
updated_at: 2026-04-16T03:21:33Z
parent: ps-zs93
---

The `pk_bridge_configs.pkTokenEncrypted` column has been changed from `pgBinary`/`sqliteBinary` to `pgEncryptedBlob`/`sqliteEncryptedBlob` (zero-knowledge audit fix M2). The schema now expects a proper T1 encrypted blob.

When implementing the PK bridge client code, the PluralKit API token MUST be encrypted client-side with the master key (XChaCha20-Poly1305) before being sent to the server. The server must never see the plaintext PK token.

## Requirements

- [ ] Client encrypts PK token with master key before sending to server via tRPC/REST
- [ ] Client decrypts PK token from the `encryptedData` blob when needed for PK API calls
- [ ] Server never receives or handles the plaintext PK token
- [ ] The PK bridge sync worker (if server-side) must NOT have access to the plaintext token — sync must be client-initiated or use a client-encrypted credential

## Context

- Schema change: `packages/db/src/schema/pg/pk-bridge.ts` — `pkTokenEncrypted` now uses `pgEncryptedBlob`
- Type change: `packages/types/src/pk-bridge.ts` — `pkToken` is now `EncryptedBlob` (was `EncryptedString` phantom brand)
- Zero-knowledge audit (2026-04-15) finding M2
