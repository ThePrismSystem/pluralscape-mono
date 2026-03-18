# Threat Model — Pluralscape

## Assets

| Asset                | Description                                              | Classification | Priority |
| -------------------- | -------------------------------------------------------- | -------------- | -------- |
| Account credentials  | Email hash + Argon2id password hash                      | Critical       | Critical |
| Master keys          | KEK-wrapped AES-256 keys (per-account)                   | Critical       | Critical |
| Recovery keys        | 256-bit keys encrypting master key backup                | Critical       | Critical |
| Session tokens       | 256-bit random tokens (BLAKE2b-hashed in DB)             | Critical       | Critical |
| Bucket keys          | Per-privacy-bucket symmetric keys (XChaCha20-Poly1305)   | Critical       | Critical |
| E2E encrypted data   | Member data, field values, journal entries               | Critical       | Critical |
| PostgreSQL database  | All relational data with RLS policies                    | Critical       | Critical |
| SQLite database      | Self-hosted mode, SQLCipher encrypted                    | Critical       | Critical |
| Blob storage         | S3/filesystem-backed encrypted blobs                     | High           | High     |
| Audit log            | IP addresses, user agents, action history                | High           | High     |
| Session metadata     | Timestamps, platform, idle tracking                      | Medium         | Medium   |
| System metadata      | Account type, nomenclature settings, creation timestamps | Medium         | Medium   |
| Webhook HMAC secrets | Server-readable signing keys (T3 data)                   | Medium         | Medium   |
| API rate limit state | In-memory or Valkey-backed counters                      | Low            | Low      |

## Trust Boundaries

```
Trust Boundaries:
  +-- Mobile App <--> API Server (TLS, session tokens)
  |     +-- Cleartext UI data <--> E2E encrypted payloads
  |     +-- Biometric hardware <--> Biometric token verification
  |
  +-- API Server <--> PostgreSQL (RLS policies, parameterized queries)
  |     +-- Application-level auth <--> DB-level RLS enforcement
  |     +-- API request scope <--> Multi-tenant data isolation
  |
  +-- API Server <--> S3/MinIO (presigned URLs, encrypted blobs)
  |     +-- Authenticated API <--> Time-limited presigned URLs
  |
  +-- API Server <--> Valkey (rate limit state, job queues)
  |     +-- Rate limit enforcement <--> Shared state consistency
  |
  +-- Public routes <--> Authenticated routes (auth middleware)
  |     +-- /auth/register, /auth/login <--> All other routes
  |
  +-- System owner <--> System member (Privacy Buckets)
  |     +-- Per-bucket symmetric keys <--> Key grant distribution
  |
  +-- Self-hosted <--> Hosted deployment modes
        +-- Plaintext search index <--> Encrypted-only mode
```

## STRIDE Analysis

### Spoofing

| Threat                           | Target                 | Risk   | Controls                                                              | Residual   |
| -------------------------------- | ---------------------- | ------ | --------------------------------------------------------------------- | ---------- |
| Credential stuffing              | `/auth/login`          | High   | Argon2id (256MB/3 iter), 5 req/min rate limit, anti-timing dummy hash | Low        |
| Session hijacking                | Session tokens         | High   | 256-bit entropy, BLAKE2b hashing, TLS-only, idle/absolute TTL         | Low        |
| IP spoofing via X-Forwarded-For  | Rate limiter           | Medium | `TRUST_PROXY` guard, `isValidIpFormat()` validation                   | Low        |
| Recovery key brute force         | `/auth/password-reset` | Medium | 256-bit key (2^256 keyspace), rate limited 5/min                      | Very Low   |
| Device transfer code brute force | Transfer flow          | Medium | 26.5-bit code + Argon2id + 5-min timeout                              | Low-Medium |

### Tampering

| Threat                    | Target            | Risk     | Controls                                                | Residual |
| ------------------------- | ----------------- | -------- | ------------------------------------------------------- | -------- |
| SQL injection             | All DB queries    | Critical | Drizzle ORM parameterized queries, RLS                  | Very Low |
| Request body manipulation | All endpoints     | High     | Zod schema validation on all routes, body limit 256 KiB | Very Low |
| Encrypted data tampering  | E2E payloads      | High     | AEAD (XChaCha20-Poly1305) — integrity + authentication  | Very Low |
| Blob content tampering    | S3 objects        | Medium   | Client-side encryption, checksum metadata               | Low      |
| Stream chunk reordering   | Encrypted streams | Medium   | Chunk index + total in AAD                              | Low      |

### Repudiation

| Threat                  | Target           | Risk   | Controls                                          | Residual |
| ----------------------- | ---------------- | ------ | ------------------------------------------------- | -------- |
| Deny security events    | Auth actions     | Medium | Audit log (21 event types), IP + UA recorded      | Low      |
| Deny data changes       | Entity mutations | Medium | Audit events on all state changes, version fields | Low      |
| Tamper with audit trail | Audit log table  | Low    | DB-level RLS, append-only pattern                 | Low      |

### Information Disclosure

| Threat                     | Target               | Risk     | Controls                                                   | Residual   |
| -------------------------- | -------------------- | -------- | ---------------------------------------------------------- | ---------- |
| Login timing oracle        | Email enumeration    | Medium   | Dummy Argon2id hash, but audit write timing leaks          | Medium     |
| Error message leakage      | Validation schemas   | Medium   | ZodError masked in production, 5xx masked                  | Low        |
| Audit log PII              | IP + UA strings      | Medium   | Cleanup job exists, GDPR retention applies                 | Low-Medium |
| E2E encrypted data at rest | Server DB compromise | Critical | Zero-knowledge (XChaCha20-Poly1305), server cannot decrypt | Very Low   |
| Webhook HMAC secrets       | T3 server-readable   | Medium   | Necessary trade-off, DB encryption at rest                 | Low-Medium |

### Denial of Service

| Threat                      | Target           | Risk   | Controls                                                   | Residual |
| --------------------------- | ---------------- | ------ | ---------------------------------------------------------- | -------- |
| Request flooding            | API availability | High   | Global rate limit (100/min), per-category limits           | Low      |
| Argon2id CPU exhaustion     | Auth endpoints   | High   | 5 req/min authHeavy limit, body limit caps password length | Low      |
| Large payload               | Request parsing  | Medium | 256 KiB body limit, per-field max lengths                  | Low      |
| Rate limit bucket pollution | In-memory store  | Low    | IP format validation, 10K entry eviction                   | Low      |

### Elevation of Privilege

| Threat                          | Target             | Risk     | Controls                                                        | Residual |
| ------------------------------- | ------------------ | -------- | --------------------------------------------------------------- | -------- |
| Cross-system data access        | Multi-tenant       | Critical | RLS policies (fail-closed), ownership assertion, scoped queries | Low      |
| IDOR via parameter manipulation | Entity endpoints   | High     | All queries scoped to auth.accountId + systemId                 | Very Low |
| Session revocation bypass       | Session management | Medium   | WHERE clause includes accountId, pre-transaction check          | Low      |
| Cross-system blob access        | Blob storage       | High     | assertSystemOwnership + DB WHERE systemId scoping               | Very Low |
