# Threat Model — STRIDE Analysis

**Date:** 2026-03-31 13:47
**Scope:** Full monorepo (apps/api, apps/mobile, packages/\*)

## Asset Inventory

| Asset                             | Type                   | Priority | Location                                                |
| --------------------------------- | ---------------------- | -------- | ------------------------------------------------------- |
| User accounts (credentials, keys) | Data store             | Critical | PostgreSQL `accounts`, `auth_keys`, `sessions`          |
| Session tokens                    | Authentication         | Critical | PostgreSQL `sessions.tokenHash`                         |
| Master encryption keys            | Cryptographic material | Critical | `accounts.encryptedMasterKey`, mobile Keychain/Keystore |
| Recovery keys                     | Cryptographic material | Critical | `recovery_keys.encryptedMasterKey`                      |
| Email addresses                   | PII                    | High     | `accounts.emailHash`, `accounts.encryptedEmail`         |
| Member/system data                | E2E encrypted content  | High     | Multiple tables with `encryptedBlob` columns            |
| API keys                          | Authentication         | High     | `api_keys.tokenHash`                                    |
| Webhook configs (secrets)         | Secrets                | High     | `webhook_configs.secret`                                |
| Biometric tokens                  | Authentication         | High     | `biometric_tokens.tokenHash`                            |
| Audit log (IP, User-Agent)        | PII                    | Medium   | `audit_log.ipAddress`, `audit_log.userAgent`            |
| Friend connections                | Relationship data      | Medium   | `friend_connections`, `friend_codes`                    |
| Blob storage (S3/filesystem)      | File storage           | Medium   | S3 bucket or `./data/blobs`                             |
| Valkey/Redis cache                | Ephemeral state        | Medium   | Rate limit counters, idempotency cache                  |
| Webhook delivery payloads         | Event data             | Medium   | `webhook_deliveries`                                    |
| Sync documents (CRDTs)            | E2E encrypted content  | Medium   | `sync_documents`, `sync_changes`                        |

## Trust Boundaries

```
Trust Boundaries:
  ├── Mobile App ←→ API Server (client/server, Bearer token auth)
  │   ├── WebSocket upgrade (origin validation + auth timeout)
  │   └── REST API (rate limiting + input validation)
  ├── API Server ←→ PostgreSQL (RLS-enforced tenant isolation)
  │   ├── Account-scoped transactions (app.current_account_id GUC)
  │   ├── System-scoped transactions (app.current_system_id GUC)
  │   └── Cross-account reads (SET TRANSACTION READ ONLY)
  ├── API Server ←→ S3 (presigned URLs, server-generated keys)
  ├── API Server ←→ Valkey (rate limits, idempotency, pub/sub)
  ├── API Server ←→ External Webhooks (SSRF-validated URLs, HMAC-signed)
  ├── API Server ←→ Email Provider (Resend/SMTP, server-side only)
  ├── Unauthenticated ←→ Authenticated routes (Bearer middleware)
  ├── Account owner ←→ Friend viewer (bucket-scoped key grants)
  └── E2E encrypted (T1) ←→ Server-readable (T3) data boundaries
```

## STRIDE Threat Matrix

### Spoofing

| Threat                          | Asset            | Risk   | Mitigation                                                           | Residual Risk       |
| ------------------------------- | ---------------- | ------ | -------------------------------------------------------------------- | ------------------- |
| Session token theft             | Sessions         | High   | BLAKE2b hashing, no plaintext storage, absolute + idle TTL           | Low                 |
| Account impersonation via email | Accounts         | High   | Argon2id password hashing, anti-enumeration timing, login throttling | Low                 |
| Biometric token replay          | Biometric tokens | Medium | One-time use (UPDATE WHERE usedAt IS NULL), session-scoped           | Low                 |
| API key compromise              | API keys         | Medium | SHA-256 hashing, one-time display, revocable, scope-limited          | Low                 |
| WebSocket connection hijacking  | WS sessions      | Medium | Origin validation, auth timeout (10s), connection rate limits        | Low                 |
| Certificate spoofing (mobile)   | Network          | Medium | TLS transport                                                        | Medium (no pinning) |

### Tampering

| Threat                    | Asset        | Risk     | Mitigation                                                                 | Residual Risk |
| ------------------------- | ------------ | -------- | -------------------------------------------------------------------------- | ------------- |
| SQL injection             | Database     | Critical | Drizzle ORM parameterization (all queries)                                 | Negligible    |
| Request body manipulation | API input    | High     | Zod schema validation, Content-Type enforcement, body size limit (256 KiB) | Low           |
| Webhook payload tampering | Webhooks     | Medium   | HMAC signing with per-config secrets                                       | Low           |
| CRDT sync data tampering  | Sync docs    | Medium   | E2E encryption (XChaCha20-Poly1305), signature verification                | Low           |
| Friend code expiry bypass | Friend codes | Low      | DB-level expiry check (minor TOCTOU window)                                | Low           |

### Repudiation

| Threat                  | Asset              | Risk   | Mitigation                                                           | Residual Risk |
| ----------------------- | ------------------ | ------ | -------------------------------------------------------------------- | ------------- |
| Denied security events  | Audit log          | Medium | Comprehensive audit logging (200+ event types), IP tracking (opt-in) | Low           |
| Session activity denial | Sessions           | Low    | lastActive tracking, request ID per request                          | Low           |
| Webhook delivery denial | Webhook deliveries | Low    | Delivery records with attempt tracking                               | Low           |

### Information Disclosure

| Threat                    | Asset         | Risk   | Mitigation                                                          | Residual Risk |
| ------------------------- | ------------- | ------ | ------------------------------------------------------------------- | ------------- |
| Error message leakage     | API responses | Medium | Production masking (5xx details stripped), structured error codes   | Low           |
| Session state enumeration | Sessions      | Medium | **FINDING:** Different error codes for expired vs invalid sessions  | Medium        |
| Email enumeration         | Accounts      | Medium | Anti-enumeration timing (equalizeAntiEnumTiming), dummy Argon2 hash | Low           |
| Sensitive data in logs    | Logs          | Low    | Structured logging (pino), no string interpolation of user data     | Low           |
| Key material in memory    | Crypto keys   | Low    | memzero() on all sensitive buffers, intermediate buffer risk        | Low           |

### Denial of Service

| Threat                        | Asset            | Risk   | Mitigation                                                          | Residual Risk |
| ----------------------------- | ---------------- | ------ | ------------------------------------------------------------------- | ------------- |
| Rate limit exhaustion         | API availability | Medium | Fixed-window rate limiting (global + per-category + per-account)    | Low           |
| WebSocket connection flooding | WS server        | Medium | Connection limits, unauth slot reservation with timeout             | Low           |
| Session table bloat           | Database         | Low    | MAX_SESSIONS_PER_ACCOUNT (revokes oldest), **minor race condition** | Low           |
| Large payload attacks         | API server       | Low    | 256 KiB body limit, blob size limits per purpose                    | Low           |

### Elevation of Privilege

| Threat                       | Asset          | Risk     | Mitigation                                                     | Residual Risk |
| ---------------------------- | -------------- | -------- | -------------------------------------------------------------- | ------------- |
| Cross-tenant data access     | System data    | Critical | RLS on all ~80 tables with FORCE, assertSystemOwnership()      | Low           |
| IDOR on system resources     | API endpoints  | High     | ownedSystemIds set in auth context, 404 (not 403) on failures  | Low           |
| Friend access escalation     | Bucket data    | Medium   | assertFriendAccess(), bucket-scoped key grants, READ ONLY mode | Low           |
| API key scope bypass         | API operations | Medium   | Scope enforcement, scopedBucketIds, system ownership check     | Low           |
| Unknown session type timeout | Sessions       | Medium   | **FINDING:** Falls back to web idle timeout for unknown types  | Medium        |
