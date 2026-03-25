# Threat Model — Pluralscape Full STRIDE Analysis

**Date:** 2026-03-24 21:24
**Scope:** Full monorepo (apps/api, packages/\*)

## Assets

| Asset Type     | Name                  | Priority | Details                                                              |
| -------------- | --------------------- | -------- | -------------------------------------------------------------------- |
| Data store     | PostgreSQL            | Critical | Accounts, sessions, members, fronting data, encrypted blobs metadata |
| Data store     | Valkey (Redis)        | High     | Rate limit counters, SSE pub/sub, cache                              |
| Data store     | S3/MinIO              | Critical | Encrypted blob storage (avatars, photos, exports)                    |
| Authentication | Session tokens        | Critical | 64-char hex, hashed with BLAKE2b before storage                      |
| Authentication | Biometric tokens      | High     | Hashed, stored in DB                                                 |
| Authentication | Recovery keys         | Critical | Base32-encoded 256-bit key, encrypts master key backup               |
| Authentication | Device transfer codes | High     | 10-digit numeric, Argon2id-derived key, 5-min TTL                    |
| Encryption     | Master keys           | Critical | Per-account 256-bit key, KEK/DEK pattern, Argon2id                   |
| Encryption     | Bucket keys           | Critical | Per-privacy-bucket symmetric keys, X25519 key grants                 |
| Encryption     | Identity keypairs     | Critical | Ed25519 signing + X25519 encryption, derived from master key         |
| API            | 94+ REST endpoints    | High     | Hono framework, auth-protected except health/auth                    |
| API            | WebSocket sync        | Critical | Real-time CRDT sync, origin-validated, auth-required                 |
| API            | SSE notifications     | Medium   | Per-account event stream                                             |
| API            | Webhook delivery      | High     | HMAC-SHA256 signed payloads                                          |
| Configuration  | EMAIL_HASH_PEPPER     | Critical | Single 32-byte key for deterministic email hashing                   |
| Configuration  | SQLITE_ENCRYPTION_KEY | High     | Optional AES-256 key for SQLCipher                                   |
| User Input     | JSON request bodies   | High     | Zod-validated, 256KiB body limit                                     |
| User Input     | WebSocket messages    | High     | Zod-validated, max message size enforced                             |
| User Input     | URL parameters        | High     | ID prefix validation (requireIdParam)                                |
| User Input     | File uploads          | High     | Presigned S3 URLs, size/type limits                                  |

## Trust Boundaries

```
Trust Boundaries:
  ├── Mobile/Web Client ←→ API Server (TLS, auth tokens, encrypted payloads)
  ├── API Server ←→ PostgreSQL (RLS policies, GUC session vars)
  ├── API Server ←→ Valkey (rate limits, pub/sub — no auth in dev)
  ├── API Server ←→ S3/MinIO (presigned URLs, encrypted blobs)
  ├── Public routes ←→ Authenticated routes (authMiddleware gate)
  ├── Account scope ←→ System scope (multi-tenant RLS isolation)
  ├── Self-hosted ←→ Hosted mode (deployment guard middleware)
  ├── WebSocket unauth ←→ WebSocket auth'd (auth timeout window)
  └── CI/CD ←→ Production (frozen lockfile, SHA-pinned actions)
```

## STRIDE Threat Matrix

### Spoofing (S)

| Threat                        | Risk   | Mitigations Present                                  | Residual Risk                              |
| ----------------------------- | ------ | ---------------------------------------------------- | ------------------------------------------ |
| Session token theft           | High   | Tokens hashed in DB, HTTPS-only, no JWT              | Cookie/header interception if TLS stripped |
| Email enumeration on register | Medium | Anti-enumeration timing (constant-time fake success) | Timing side channels possible              |
| Biometric replay              | Medium | Token hashed, device-bound                           | No evidence of device attestation          |
| WebSocket auth bypass         | High   | Origin validation, auth timeout, subprotocol check   | TBD — needs code review                    |
| CSRF on state-changing ops    | Medium | No cookies used (Bearer tokens), CORS strict         | Minimal risk with token auth               |

### Tampering (T)

| Threat                      | Risk   | Mitigations Present                           | Residual Risk                          |
| --------------------------- | ------ | --------------------------------------------- | -------------------------------------- |
| Request body injection      | High   | Zod validation, Drizzle ORM (no raw SQL)      | Schema bypass if validation incomplete |
| WebSocket message tampering | High   | Zod schemas, message size limits              | TBD — review message handling          |
| Webhook payload tampering   | Medium | HMAC-SHA256 signature, timestamp header       | Replay window TBD                      |
| Blob content tampering      | Low    | SHA-256 checksum on upload, encrypted at rest | Client must verify checksums           |
| URL parameter manipulation  | High   | ID prefix validation, RLS isolation           | IDOR if ownership check missing        |

### Repudiation (R)

| Threat                  | Risk   | Mitigations Present                        | Residual Risk                       |
| ----------------------- | ------ | ------------------------------------------ | ----------------------------------- |
| Action denial           | Medium | Audit logging with 80+ event types         | IP/UA tracking opt-in (default off) |
| Session abuse denial    | Medium | Session table tracks lastActive, createdAt | No device fingerprinting            |
| Webhook delivery denial | Low    | Delivery table with status tracking        | 30-day retention limit              |

### Information Disclosure (I)

| Threat                    | Risk   | Mitigations Present                                  | Residual Risk                          |
| ------------------------- | ------ | ---------------------------------------------------- | -------------------------------------- |
| Error message leakage     | Medium | 5xx masked in production, structured errors          | TBD — review error handler             |
| PII in logs               | Medium | Structured logging (Pino), no plaintext email stored | Log injection possible if input logged |
| Email exposure            | Low    | BLAKE2b-keyed hash, pepper-protected                 | Pepper loss = lookup breakage          |
| Encrypted data exposure   | Low    | E2E encryption, zero-knowledge server                | Key management is critical path        |
| Stack traces in responses | Medium | Error handler masks in production                    | TBD — verify production behavior       |

### Denial of Service (D)

| Threat                      | Risk   | Mitigations Present                            | Residual Risk                           |
| --------------------------- | ------ | ---------------------------------------------- | --------------------------------------- |
| Brute force login           | Medium | authHeavy rate limit (5/min), login throttling | TBD — review per-account throttle       |
| Argon2id DoS (password ops) | Medium | Password max 256 chars, rate limiting          | CPU exhaustion on registration bursts   |
| WebSocket connection flood  | Medium | Max unauthed connections cap, auth timeout     | TBD — review limits                     |
| SSE connection exhaustion   | Medium | Per-account SSE limit, rate limiting           | TBD — review limits                     |
| Large body DoS              | Low    | 256KiB body limit, blob size limits            | Upload presigned URLs bypass body limit |
| ReDoS                       | Low    | Zod validation (no custom regex on user input) | TBD — review regex patterns             |

### Elevation of Privilege (E)

| Threat                      | Risk     | Mitigations Present                     | Residual Risk                         |
| --------------------------- | -------- | --------------------------------------- | ------------------------------------- |
| IDOR (cross-account access) | Critical | RLS policies, systemId ownership checks | TBD — review all parameterized routes |
| System ownership bypass     | Critical | Auth middleware + RLS dual isolation    | TBD — verify every route              |
| API key scope escalation    | High     | Scopes stored as JSONB, validated       | TBD — review scope enforcement        |
| Deployment guard bypass     | Medium   | Middleware blocks hosted-only endpoints | TBD — review guard coverage           |
| Admin functionality access  | Medium   | No admin panel detected                 | N/A currently                         |
