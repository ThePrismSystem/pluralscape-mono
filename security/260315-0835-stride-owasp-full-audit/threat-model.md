# Threat Model — Pluralscape

## Tech Stack

| Component | Technology                                            |
| --------- | ----------------------------------------------------- |
| API       | Hono on Bun (TypeScript)                              |
| Mobile    | Expo + React Native                                   |
| Database  | PostgreSQL (server) + SQLite/SQLCipher (mobile)       |
| ORM       | Drizzle                                               |
| Crypto    | libsodium (WASM + RN JSI)                             |
| Sync      | Automerge CRDTs, encrypted relay                      |
| Queue     | Custom job queue interface                            |
| Storage   | Abstract blob adapter (presigned URLs)                |
| CI        | GitHub Actions, CodeQL                                |
| Auth      | Password + Argon2id KDF + KEK/DEK master key wrapping |

## Asset Inventory

| Asset                                | Type                            | Sensitivity  | Location                                                               |
| ------------------------------------ | ------------------------------- | ------------ | ---------------------------------------------------------------------- |
| Master encryption key                | Cryptographic key               | **Critical** | Client-side memory, encrypted at rest (accounts.encryptedMasterKey)    |
| User password hash                   | KDF output (Argon2id)           | **Critical** | accounts.passwordHash                                                  |
| Identity keypairs (X25519 + Ed25519) | Cryptographic keys              | **Critical** | Derived from master key; encrypted private keys in authKeys table      |
| Recovery key                         | 256-bit random (base32 display) | **Critical** | User responsibility; encrypted master key backup in recoveryKeys table |
| Bucket encryption keys               | AeadKey (32 bytes)              | **Critical** | Encrypted in keyGrants, managed via bucket-keys module                 |
| Session data                         | Encrypted blob                  | **High**     | sessions table, E2E encrypted                                          |
| Member profiles                      | Encrypted blob                  | **High**     | members.encryptedData, E2E encrypted                                   |
| System profiles                      | Encrypted blob                  | **High**     | systems.encryptedData, E2E encrypted                                   |
| Fronting history                     | CRDT documents                  | **High**     | Encrypted sync documents                                               |
| Journal entries                      | CRDT documents                  | **High**     | Encrypted sync documents                                               |
| Chat messages                        | CRDT documents                  | **High**     | Encrypted sync documents                                               |
| Audit log (IP, UA)                   | GDPR personal data              | **Medium**   | auditLog table, plaintext                                              |
| API key tokens                       | Hashed tokens                   | **High**     | apiKeys.tokenHash                                                      |
| Webhook HMAC secrets                 | Binary (T3 server-readable)     | **Medium**   | webhookConfigs.secret                                                  |
| Device push tokens                   | Platform tokens                 | **Medium**   | deviceTokens.token                                                     |
| Friend codes                         | 8+ char codes                   | **Low**      | friendCodes.code                                                       |
| Email hash + salt                    | Salted hash                     | **Medium**   | accounts.emailHash + accounts.emailSalt                                |
| Device transfer code                 | 8 decimal digits                | **Medium**   | Transient (5-min TTL)                                                  |

## Trust Boundaries

```
Trust Boundaries:
  +-- Mobile App <--E2E Encrypted--> API Server
  |   +-- User input (forms, QR scan) --> Crypto layer (client-side)
  |   +-- Key lifecycle state machine (locked/unlocked/grace)
  |   +-- Biometric gate --> Key access
  |
  +-- API Server <--TLS--> PostgreSQL
  |   +-- RLS policies (GUC session vars: app.current_system_id, app.current_account_id)
  |   +-- Application-layer auth (not yet implemented)
  |
  +-- API Server <--TLS--> External Services
  |   +-- Webhook delivery (HMAC-signed)
  |   +-- Push notifications (APNs/FCM)
  |   +-- Blob storage (presigned URLs)
  |
  +-- Sync Layer
  |   +-- Client <--WebSocket/TLS--> Sync Relay
  |   +-- Encrypted CRDT envelopes (AEAD + Ed25519 signatures)
  |   +-- Document key resolution (master key vs bucket key)
  |
  +-- Friend Sharing
  |   +-- Key grants (XSalsa20-Poly1305 crypto_box)
  |   +-- Bucket-scoped access control
  |   +-- Privacy tiers (T1 zero-knowledge, T2 per-bucket, T3 plaintext)
  |
  +-- CI/CD <--> Production
      +-- GitHub Actions
      +-- CodeQL analysis
      +-- Dependabot
```

## STRIDE Threat Analysis

### S — Spoofing

| Threat                    | Asset/Boundary      | Risk   | Status                                                                        |
| ------------------------- | ------------------- | ------ | ----------------------------------------------------------------------------- |
| Password brute force      | Auth endpoint       | High   | No rate limiting middleware exists                                            |
| Session token theft       | Client-server       | High   | Sessions exist in schema but no auth middleware implemented                   |
| Transfer code brute force | Device transfer     | Medium | 8 digits (~26.5 bits); Argon2id protects offline; 5-min timeout limits online |
| API key impersonation     | API key auth        | High   | Token hash stored but no verification middleware                              |
| Sync session spoofing     | Sync relay          | Medium | Auth protocol defined but relies on sessionToken validation                   |
| Recovery key theft        | Master key recovery | High   | Physical/social engineering vector; key format is 52 base32 chars             |

### T — Tampering

| Threat                        | Asset/Boundary       | Risk | Status                                                                     |
| ----------------------------- | -------------------- | ---- | -------------------------------------------------------------------------- |
| CRDT data tampering           | Sync layer           | Low  | Every envelope is AEAD-encrypted + Ed25519 signed; AAD binds to documentId |
| Webhook payload tampering     | Webhook delivery     | Low  | HMAC-signed payloads                                                       |
| Bucket key grant tampering    | Friend sharing       | Low  | crypto_box authenticated encryption + envelope binding validation          |
| Encrypted blob tampering      | Data at rest         | Low  | XChaCha20-Poly1305 provides authentication                                 |
| Stream chunk reordering       | Streaming encryption | Low  | Chunk AAD includes index + total count                                     |
| Snapshot version manipulation | Sync snapshots       | Low  | AAD includes documentId + snapshotVersion                                  |

### R — Repudiation

| Threat                            | Asset/Boundary | Risk   | Status                                                     |
| --------------------------------- | -------------- | ------ | ---------------------------------------------------------- |
| Unlogged auth events              | Audit system   | Low    | Comprehensive audit event types defined                    |
| Missing audit for data access     | Data queries   | Medium | Audit events for mutations defined; read access not logged |
| Unsigned sync changes             | Sync relay     | Low    | All changes are Ed25519 signed with authorPublicKey        |
| Missing webhook delivery tracking | Webhook system | Low    | webhookDeliveries table tracks status and attempts         |

### I — Information Disclosure

| Threat                          | Asset/Boundary | Risk   | Status                                                       |
| ------------------------------- | -------------- | ------ | ------------------------------------------------------------ |
| Error stack traces in responses | API            | Medium | No error handling middleware configured                      |
| Audit log PII (IP, UA)          | Audit system   | Medium | Stored in plaintext; retention policy not enforced in schema |
| Webhook secret in DB            | Webhook config | Medium | Stored as T3 (server-readable binary), not E2E encrypted     |
| Device push tokens in plaintext | Notifications  | Low    | Required by push services; standard practice                 |
| Email hash reversibility        | Account data   | Low    | Salted hash; salt stored per-account                         |

### D — Denial of Service

| Threat                    | Asset/Boundary | Risk   | Status                                                                      |
| ------------------------- | -------------- | ------ | --------------------------------------------------------------------------- |
| No rate limiting on API   | All endpoints  | High   | No rate limiting middleware exists                                          |
| Argon2id CPU exhaustion   | Auth/transfer  | Medium | Password hashing is intentionally expensive; no concurrent request limiting |
| Large blob uploads        | Storage        | Low    | BlobTooLargeError exists in adapter; server-side limit enforcement TBD      |
| Sync document size growth | Sync layer     | Low    | Storage budget + compaction + time-split mechanisms exist                   |
| CRDT state explosion      | Sync documents | Low    | Document size limits defined (DOCUMENT_SIZE_LIMITS)                         |

### E — Elevation of Privilege

| Threat                   | Asset/Boundary | Risk         | Status                                                    |
| ------------------------ | -------------- | ------------ | --------------------------------------------------------- |
| Missing auth middleware  | API routes     | **Critical** | No authentication/authorization middleware implemented    |
| RLS bypass (SQLite)      | Mobile DB      | Medium       | SQLite has no RLS; relies on application-layer scoping    |
| API scope bypass         | API keys       | Medium       | Scopes defined but no enforcement middleware              |
| Cross-system data access | Multi-tenant   | High         | RLS policies exist for PG; fail-closed (NULL = no access) |
| Key version 0 acceptance | Crypto layer   | Low          | validateKeyVersion accepts 0; DB schema requires >= 1     |
