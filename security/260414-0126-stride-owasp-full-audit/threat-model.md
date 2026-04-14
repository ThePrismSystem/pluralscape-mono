# Threat Model — Pluralscape Full Audit

**Date:** 2026-04-14
**Scope:** Full monorepo (apps/api, packages/\*, apps/mobile data layer)

## Assets

| Asset                                            | Type                   | Priority | Location                                               |
| ------------------------------------------------ | ---------------------- | -------- | ------------------------------------------------------ |
| Account credentials (password hashes, KDF salts) | Data Store             | Critical | `accounts` table                                       |
| Session tokens                                   | Authentication         | Critical | `sessions` table (stored as BLAKE2b hash)              |
| API keys                                         | Authentication         | Critical | `api_keys` table (stored as HMAC-SHA256 hash)          |
| Master encryption keys                           | Cryptographic Material | Critical | Client-side, wrapped via Argon2id-derived KEK          |
| Bucket encryption keys                           | Cryptographic Material | Critical | Client-side, derived from master key via BLAKE2b-KDF   |
| Email addresses                                  | PII                    | Critical | Stored as BLAKE2b hash + XChaCha20-Poly1305 encrypted  |
| Recovery keys                                    | Authentication         | Critical | `recovery_keys` table (encrypted backup of master key) |
| Member/system data                               | User Data              | High     | Encrypted client-side, stored as opaque blobs          |
| Webhook secrets                                  | Authentication         | High     | `webhook_configs` table (256-bit HMAC secrets)         |
| Journal entries, notes                           | User Data              | High     | Encrypted, no per-system quota                         |
| Fronting history                                 | User Data              | High     | Encrypted, time-range based                            |
| Friend connections                               | Social Graph           | Medium   | `friend_connections` table                             |
| Audit log (IP, user-agent)                       | PII/Metadata           | Medium   | `audit_log` table                                      |
| Device transfer codes                            | Authentication         | Medium   | 10-digit, Argon2id-protected, 5-min TTL                |

## Trust Boundaries

```
Trust Boundaries:
  ├── Mobile App ←→ API Server
  │   ├── TLS transport (HTTPS/WSS)
  │   ├── Bearer token authentication (session or API key)
  │   └── Client-side encryption boundary (server never sees plaintext)
  ├── API Server ←→ PostgreSQL
  │   ├── Row-Level Security (GUC-based tenant isolation)
  │   ├── Account-scoped vs system-scoped vs cross-account queries
  │   └── Transaction-pinned connections (connection pooling safety)
  ├── API Server ←→ Valkey (Redis)
  │   ├── Rate limit state, SSE pub/sub, session revocation
  │   └── Falls back to in-memory when unavailable
  ├── API Server ←→ S3/Filesystem (Blob Storage)
  │   ├── Signed upload URLs (two-stage upload)
  │   └── Quota enforcement at URL generation time
  ├── API Server ←→ External Webhooks
  │   ├── HMAC-SHA256 signed payloads
  │   ├── Optional XChaCha20-Poly1305 payload encryption
  │   ├── DNS resolution with SSRF validation + IP pinning
  │   └── Per-host concurrency throttle
  ├── Public routes ←→ Authenticated routes
  │   ├── Auth middleware (session token or API key)
  │   ├── Scope gate for API keys (fail-closed)
  │   └── System ownership check (O(1) Set lookup)
  ├── Account A ←→ Account B (Friend Access)
  │   ├── Cross-account read (no RLS, application-level validation)
  │   ├── Bilateral friend connection verification
  │   └── Bucket-scoped visibility (intersection logic)
  └── WebSocket ←→ REST
      ├── Separate auth (session token in first message)
      ├── 10-second auth timeout, per-IP/global connection caps
      └── Per-connection rate limiting with strike system
```

## STRIDE Threat Matrix

### Spoofing

| Threat                               | Risk   | Mitigation                                                    | Status    |
| ------------------------------------ | ------ | ------------------------------------------------------------- | --------- |
| Session token theft                  | Medium | 256-bit random, BLAKE2b hashed, idle+absolute timeout         | Mitigated |
| API key impersonation                | Medium | HMAC-SHA256 hashed, scope-gated, revocable                    | Mitigated |
| Account enumeration via login timing | Low    | Dummy Argon2id work + timing equalization (500ms floor)       | Mitigated |
| Account enumeration via registration | Low    | Uniform error messages, anti-enum timing                      | Mitigated |
| Email enumeration via password reset | Low    | Dummy Argon2id + timing equalization + per-account rate limit | Mitigated |
| Brute force login                    | Low    | Per-account throttle (10 attempts/15 min) + global rate limit | Mitigated |

### Tampering

| Threat                            | Risk     | Mitigation                                                    | Status    |
| --------------------------------- | -------- | ------------------------------------------------------------- | --------- |
| SQL injection                     | Very Low | Drizzle ORM parameterized queries, no raw SQL with user input | Mitigated |
| Input validation bypass           | Very Low | Zod schemas on all endpoints, 256 KiB body limit              | Mitigated |
| CSRF on state-changing operations | Very Low | Bearer token auth (not cookie-based), no ambient credentials  | Mitigated |
| Webhook payload tampering         | Low      | HMAC-SHA256 signed, optional E2E encryption                   | Mitigated |
| Queue job injection               | Low      | Requires DB write access (protected by RLS/network)           | Accepted  |
| Import data manipulation          | Low      | Client-side encryption, mapper validation                     | Mitigated |

### Repudiation

| Threat                              | Risk     | Mitigation                                                                       | Status    |
| ----------------------------------- | -------- | -------------------------------------------------------------------------------- | --------- |
| Denial of security-relevant actions | Low      | Comprehensive audit log (login, logout, password change, deletion, key rotation) | Mitigated |
| Audit log tampering                 | Very Low | RLS-protected, cascade-safe (SET NULL on account delete)                         | Mitigated |

### Information Disclosure

| Threat                         | Risk     | Mitigation                                                           | Status      |
| ------------------------------ | -------- | -------------------------------------------------------------------- | ----------- |
| Error message leakage (server) | Very Low | 5xx masked in production, Zod errors sanitized                       | Mitigated   |
| Error message leakage (mobile) | Low      | Raw API error JSON in rest-query-factory.ts                          | **Finding** |
| PII in logs                    | Very Low | S3 log sanitizer, structured Pino logging, no token/password logging | Mitigated   |
| Sensitive headers              | Very Low | Comprehensive CSP, HSTS, X-Frame-Options, Permissions-Policy         | Mitigated   |
| Email exposure                 | Very Low | Stored as hash + encrypted, pepper-keyed BLAKE2b                     | Mitigated   |

### Denial of Service

| Threat                                        | Risk     | Mitigation                                           | Status      |
| --------------------------------------------- | -------- | ---------------------------------------------------- | ----------- |
| Rate limit bypass (multi-instance)            | Low      | In-memory fallback when Valkey unavailable           | **Finding** |
| Unbounded entity creation (notes, innerworld) | Medium   | No per-system quota on notes/innerworld entities     | **Finding** |
| Import parser memory exhaustion               | Medium   | Full document materialization, O(file_size) peak     | **Finding** |
| WebSocket slowloris                           | Very Low | 500 global unauthed cap, 50 per-IP, 10s auth timeout | Mitigated   |
| API request flooding                          | Very Low | Category-based rate limiting, Valkey-backed          | Mitigated   |

### Elevation of Privilege

| Threat                             | Risk     | Mitigation                                                                 | Status    |
| ---------------------------------- | -------- | -------------------------------------------------------------------------- | --------- |
| IDOR (accessing other users' data) | Very Low | RLS + system ownership check + 404 on mismatch                             | Mitigated |
| API key scope escalation           | Very Low | Scope gate middleware, fail-closed on missing registry                     | Mitigated |
| Friend access bypass               | Very Low | assertFriendAccess: bilateral checks, single-transaction TOCTOU prevention | Mitigated |
| Cross-account data leak            | Low      | withCrossAccountRead enforces READ ONLY, application validation            | Mitigated |
| Admin privilege escalation         | N/A      | No admin role exists; account_type is system/viewer only                   | N/A       |
