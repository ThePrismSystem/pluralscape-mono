# Threat Model — Pluralscape

## Assets

| Asset                                                           | Type           | Tier     | Priority |
| --------------------------------------------------------------- | -------------- | -------- | -------- |
| Account credentials (passwordHash, kdfSalt, encryptedMasterKey) | Data Store     | Critical | Critical |
| Session tokens (`sess_` + UUID)                                 | Authentication | Critical | Critical |
| Recovery keys (base32, 256-bit entropy)                         | Authentication | Critical | Critical |
| Master key (KEK/DEK envelope)                                   | Encryption     | Critical | Critical |
| Bucket keys (per-privacy-bucket symmetric keys)                 | Encryption     | Critical | Critical |
| Identity keypairs (X25519 enc, Ed25519 sign)                    | Encryption     | High     | High     |
| Email hash + pepper                                             | Data Store     | Critical | Critical |
| PostgreSQL database (hosted mode)                               | Data Store     | Critical | Critical |
| SQLite + SQLCipher (self-hosted mode)                           | Data Store     | Critical | Critical |
| Hono API endpoints                                              | API Surface    | High     | High     |
| S3/filesystem blob storage                                      | Data Store     | High     | High     |
| BullMQ/Valkey job queue                                         | Infrastructure | Medium   | Medium   |
| Audit log (IP addresses, user agents)                           | Logging        | Medium   | Medium   |
| Webhook HMAC secrets                                            | Data Store     | Medium   | Medium   |
| Device transfer codes (8 decimal digits)                        | Authentication | Medium   | Medium   |
| CRDT sync envelopes (AEAD + Ed25519)                            | Data Integrity | High     | High     |

## Trust Boundaries

```
Trust Boundaries:
  ├── Mobile App ←→ API Server (Bearer token auth over HTTPS)
  ├── API Server ←→ PostgreSQL (connection string, RLS context)
  ├── API Server ←→ Valkey/Redis (job queue, pub/sub)
  ├── API Server ←→ S3/MinIO (blob storage, presigned URLs)
  ├── Public routes (/, /health) ←→ Authenticated routes (/auth/*, /account/*, /systems/*)
  ├── System accounts ←→ Viewer accounts (accountType-based access)
  ├── Per-request RLS context ←→ Database queries (set_config per-transaction)
  ├── Client-side SQLite ←→ Server-side sync (CRDT + E2E encryption)
  └── CI/CD (GitHub Actions) ←→ Production (frozen lockfile, CodeQL)
```

## STRIDE Threat Matrix

### Spoofing

| Threat                                         | Assets Affected     | Risk   | Status                                                                   |
| ---------------------------------------------- | ------------------- | ------ | ------------------------------------------------------------------------ |
| Credential stuffing on /auth/login             | Account credentials | Medium | Mitigated: authHeavy rate limit + Argon2id cost + anti-timing dummy hash |
| Session token prediction/brute-force           | Session tokens      | Low    | Mitigated: `sess_` + UUID (122 bits entropy)                             |
| X-Forwarded-For spoofing for rate-limit bypass | Rate limiter        | Medium | Partial: TRUST_PROXY=1 required, but no IP format validation             |
| Recovery key brute-force                       | Recovery keys       | Low    | Mitigated: 256-bit entropy, requires auth, authHeavy rate limit          |
| Device transfer code brute-force               | Transfer codes      | Low    | Accepted: 26.5 bits + Argon2id + 5-min timeout                           |

### Tampering

| Threat                       | Assets Affected | Risk   | Status                                                  |
| ---------------------------- | --------------- | ------ | ------------------------------------------------------- |
| SQL injection                | Database        | Low    | Mitigated: Drizzle ORM parameterized queries throughout |
| Request body manipulation    | API endpoints   | Low    | Mitigated: Zod validation on all inputs                 |
| CRDT sync payload tampering  | Sync data       | Low    | Mitigated: AEAD + Ed25519 signatures                    |
| Prototype pollution          | Runtime         | Low    | Mitigated: No **proto** or prototype manipulation       |
| encryptedData field overflow | System updates  | Medium | Partial: body limit at 256KB but no per-field max       |

### Repudiation

| Threat                   | Assets Affected | Risk | Status                                                                          |
| ------------------------ | --------------- | ---- | ------------------------------------------------------------------------------- |
| Unlogged security events | Audit trail     | Low  | Mitigated: 21 event types covering auth, sessions, account changes, system CRUD |
| Audit log tampering      | Audit trail     | Low  | Mitigated: Insert-only pattern, partitioned by month                            |

### Information Disclosure

| Threat                         | Assets Affected    | Risk   | Status                                                                          |
| ------------------------------ | ------------------ | ------ | ------------------------------------------------------------------------------- |
| Error message leakage          | Internal structure | Medium | Partial: 5xx masked in production, but ZodError details leak on 400s            |
| Audit log PII (IP, user agent) | Personal data      | Low    | Recurring: plaintext storage, cleanup queries exist but scheduling not verified |
| Webhook HMAC secrets           | Webhook integrity  | Low    | Recurring: T3 server-readable by design                                         |
| Email enumeration via timing   | Account existence  | Low    | Mitigated: anti-timing in login + fake recovery key in registration             |

### Denial of Service

| Threat                       | Assets Affected     | Risk   | Status                                                     |
| ---------------------------- | ------------------- | ------ | ---------------------------------------------------------- |
| Argon2id CPU exhaustion      | API availability    | Medium | Mitigated: authHeavy rate limits on login/register         |
| Rate limiter bucket flooding | Rate limiter memory | Low    | Partial: X-Forwarded-For accepts arbitrary strings as keys |
| Large request bodies         | API availability    | Low    | Mitigated: 256KB body limit                                |
| Regex DoS in validation      | API availability    | Low    | Mitigated: Zod uses no custom regex patterns               |

### Elevation of Privilege

| Threat                           | Assets Affected    | Risk | Status                                                            |
| -------------------------------- | ------------------ | ---- | ----------------------------------------------------------------- |
| IDOR on system/account endpoints | Cross-user data    | Low  | Mitigated: all queries scoped to auth.accountId                   |
| Session revocation cross-user    | Session management | Low  | Mitigated: ownership check, but TOCTOU gap exists                 |
| accountType bypass               | Privilege levels   | Low  | Mitigated: validated at registration, checked in service layer    |
| RLS bypass                       | Multi-tenancy      | Low  | Mitigated: fail-closed NULLIF pattern, transaction-scoped context |
