# ADR 018: Encryption-at-Rest Boundary

## Status

Accepted

## Context

Pluralscape handles deeply sensitive data (trauma journals, identity information,
fronting histories). The encryption strategy has multiple layers, and the
boundaries between them need to be clearly documented to avoid confusion between
what is application-level E2E encryption, what is infrastructure-level defense-
in-depth, and what remains to be implemented.

## Decision

### Layer 1: End-to-End Encryption (Application Level)

Already implemented. Over 40 columns across the schema store `EncryptedBlob` values
(XChaCha20-Poly1305, X25519, Argon2id via libsodium). The server never sees
plaintext for these columns — it stores and returns opaque ciphertext blobs.
This is the primary privacy guarantee.

See ADR 006 for the encryption protocol and ADR 013 for the API auth/encryption
boundary.

### Layer 2: Infrastructure-Level Encryption (Defense-in-Depth)

#### PostgreSQL

- **pgcrypto extension**: enabled via `CREATE EXTENSION IF NOT EXISTS pgcrypto`
  in the migration. This makes `pgcrypto` functions available for any future
  server-side encryption needs (e.g., hashing metadata columns).
- **Volume/TDE encryption**: production deployments should use PostgreSQL
  Transparent Data Encryption or volume-level encryption (e.g., LUKS, AWS EBS
  encryption) to protect the data directory at rest. This is an infrastructure
  concern, not an application concern.
- **Metadata columns**: columns like `email_hash`, `ip_address`, `user_agent`,
  and `timestamp` are not E2E encrypted (the server needs them for operation).
  Infrastructure-level encryption provides defense-in-depth for these.

#### SQLite

- **SQLCipher**: planned for local encryption-at-rest per ADR 006. Currently
  using `better-sqlite3` during development. Migration to SQLCipher is a
  separate infrastructure task (see follow-up bean).
- **Mobile**: the mobile app's SQLite database will use SQLCipher to encrypt the
  entire database file, protecting locally cached data if the device is
  compromised.

### Layer 3: Transit Encryption

- **TLS**: all client-server communication uses TLS (HTTPS/WSS). This is
  separate from E2E encryption — TLS protects the transport layer, while E2E
  encryption ensures the server cannot read the payload.
- **Sync protocol**: CRDT sync payloads are E2E encrypted before transmission.

### PG Full-Text Search: Self-Hosted Only

The `search_index` table stores **plaintext** title and content for full-text
search. To preserve the zero-knowledge guarantee for hosted/cloud deployments:

- **Self-hosted PG**: `search_index` is populated by the server, because the
  operator controls the server and has access to encryption keys.
- **Hosted/cloud PG**: search remains client-side only (via SQLite FTS5 on the
  mobile app). The server never decrypts user data, so it cannot populate the
  search index.

This is enforced at the API layer, not the database layer.

## What This ADR Does NOT Cover

- **Column-level encryption details**: covered by ADR 006 (blob-codec wire
  format, key derivation, algorithm selection).
- **Key management and recovery**: covered by ADR 006 and ADR 011.
- **TLS certificate management**: infrastructure/deployment concern.
- **Per-bucket key rotation**: covered by ADR 014.

## Consequences

- The pgcrypto extension is available in all PG deployments for future use.
- Operators deploying Pluralscape must configure volume-level or TDE encryption
  independently — the application does not enforce this.
- The distinction between E2E encryption (application guarantee) and at-rest
  encryption (infrastructure guarantee) is now documented, preventing confusion
  in security reviews.
- SQLCipher migration remains a separate task to be completed before production
  mobile releases.
