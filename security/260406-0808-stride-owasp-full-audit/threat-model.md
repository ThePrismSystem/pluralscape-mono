# Threat Model — Pluralscape Full Audit

**Date:** 2026-04-06 08:08
**Methodology:** STRIDE + OWASP Top 10

## Asset Inventory

| Asset                                       | Type           | Sensitivity | Location                          |
| ------------------------------------------- | -------------- | ----------- | --------------------------------- |
| Account credentials (passwordHash, kdfSalt) | Data store     | Critical    | `accounts` table (Postgres)       |
| Master encryption keys (encryptedMasterKey) | Data store     | Critical    | `accounts` table                  |
| Auth keys (Ed25519 private keys)            | Data store     | Critical    | `authKeys` table                  |
| Session tokens (tokenHash)                  | Data store     | Critical    | `sessions` table                  |
| Recovery keys (encrypted)                   | Data store     | Critical    | `recoveryKeys` table              |
| API keys (keyHash + encrypted data)         | Data store     | High        | `apiKeys` table                   |
| Email (encryptedEmail + emailHash)          | Data store     | High        | `accounts` table                  |
| Member/headmate data (E2E encrypted)        | Data store     | High        | Various system-scoped tables      |
| Audit log (IP, user-agent)                  | Data store     | Medium      | `auditLog` table (partitioned)    |
| Blob storage (avatars, attachments)         | Data store     | Medium      | S3-compatible storage             |
| CRDT sync envelopes (encrypted)             | Data flow      | High        | Sync relay (Postgres + in-memory) |
| Device transfer material                    | Data flow      | Critical    | `deviceTransferRequests` table    |
| Webhook payloads (encrypted)                | Data flow      | Medium      | External delivery                 |
| Valkey/Redis cache (rate limit, pub/sub)    | Infrastructure | Medium      | Valkey instance                   |
| Session cookies/tokens (client-side)        | Client         | High        | Mobile secure store / browser     |

## Trust Boundaries

```
Trust Boundaries:
  ├── Mobile App ←→ API Server (TLS, Bearer token auth)
  │     └── Expo SecureStore holds session token + master key
  ├── Browser Client ←→ API Server (TLS, Bearer token auth)
  ├── API Server ←→ PostgreSQL (RLS-enforced, GUC variables)
  │     └── app.current_account_id + app.current_system_id
  ├── API Server ←→ Valkey (rate limiting, pub/sub, idempotency)
  ├── API Server ←→ S3 (presigned URLs, server-signed)
  ├── API Server ←→ Email Provider (SMTP/Resend API)
  ├── WebSocket ←→ Sync Relay (session auth in first message)
  ├── SSE ←→ Notification Stream (session auth via Bearer)
  ├── Public routes ←→ Authenticated routes (protectedProcedure)
  ├── Account-scoped ←→ System-scoped (ownedSystemIds set)
  ├── Self-hosted ←→ Hosted deployment mode
  └── Client-side crypto ←→ Server-side storage (zero-knowledge)
```

## STRIDE Analysis

### Spoofing (S)

| Threat                  | Target           | Risk   | Existing Mitigations                                       |
| ----------------------- | ---------------- | ------ | ---------------------------------------------------------- |
| Session token theft     | Auth system      | High   | SHA-256 hashed storage, TLS required, idle timeout (7-30d) |
| JWT/token forgery       | Auth system      | Low    | No JWT used — opaque session tokens with DB lookup         |
| WebSocket auth bypass   | Sync relay       | Medium | Auth in first message, connection closed on failure        |
| API key impersonation   | API keys         | Medium | Hash-indexed lookup, scope restrictions                    |
| Password brute force    | Login            | Medium | Argon2id (4 iterations, 64 MiB), rate limiting (authHeavy) |
| Anti-enumeration bypass | Login/register   | Low    | Dummy hash timing on invalid accounts (~500ms)             |
| Recovery key guessing   | Account recovery | Low    | 52-char recovery key (high entropy)                        |

### Tampering (T)

| Threat                     | Target   | Risk | Existing Mitigations                                                |
| -------------------------- | -------- | ---- | ------------------------------------------------------------------- |
| SQL injection              | Database | Low  | Drizzle ORM parameterized queries, branded ID types                 |
| CRDT envelope manipulation | Sync     | Low  | Ed25519 signed, XChaCha20-Poly1305 AEAD, AAD includes docId+version |
| Blob content tampering     | Storage  | Low  | AEAD encryption with checksum in S3 metadata                        |
| Request body manipulation  | API      | Low  | Zod validation on all tRPC inputs, 256 KiB body limit               |
| Prototype pollution        | API      | Low  | Hono framework, no manual JSON.parse on untrusted input             |

### Repudiation (R)

| Threat                      | Target       | Risk   | Existing Mitigations                                       |
| --------------------------- | ------------ | ------ | ---------------------------------------------------------- |
| Denied admin actions        | Audit system | Low    | Audit log with event types, actor JSON, IP opt-in          |
| Session manipulation denial | Auth         | Low    | Session table tracks creation, lastActive, platform        |
| Missing security event logs | Monitoring   | Medium | Audit log exists but completeness of logged events unclear |

### Information Disclosure (I)

| Threat                   | Target          | Risk   | Existing Mitigations                                       |
| ------------------------ | --------------- | ------ | ---------------------------------------------------------- |
| Email address leakage    | Account privacy | Low    | BLAKE2b hashed + XChaCha20 encrypted at rest               |
| Error message exposure   | API responses   | Low    | Safe error serialization, no stack traces in prod          |
| PII in logs              | Logging         | Medium | Pino structured logging, but need to verify no PII leakage |
| S3 presigned URL leakage | Blob storage    | Medium | Time-limited URLs (1h upload, 24h download)                |
| CRDT metadata exposure   | Sync relay      | Low    | Envelopes encrypted end-to-end                             |
| Timing side channels     | Auth            | Low    | Anti-enumeration with constant-time dummy hash             |

### Denial of Service (D)

| Threat                          | Target           | Risk    | Existing Mitigations                                    |
| ------------------------------- | ---------------- | ------- | ------------------------------------------------------- |
| API request flooding            | All endpoints    | Low     | Per-category rate limiting (IP-keyed), 429 responses    |
| WebSocket connection exhaustion | Sync             | Low     | 10 per account, 500 global unauth, 50 per-IP unauth     |
| SSE stream exhaustion           | Notifications    | Low     | 2 streams per account                                   |
| Slowloris attacks               | HTTP server      | Low     | Body limit, connection timeouts                         |
| Regex DoS                       | Input validation | Unknown | Need to audit Zod schemas for catastrophic backtracking |
| Large blob upload               | Storage          | Medium  | S3 presigned URLs bypass API, need size validation      |

### Elevation of Privilege (E)

| Threat                             | Target           | Risk   | Existing Mitigations                                   |
| ---------------------------------- | ---------------- | ------ | ------------------------------------------------------ |
| IDOR (accessing other user's data) | All resources    | Low    | RLS policies, ownedSystemIds set, 404 on unauthorized  |
| Horizontal escalation              | Cross-account    | Low    | Account-scoped RLS + application layer checks          |
| Vertical escalation                | Admin access     | N/A    | No admin endpoints exist                               |
| API key scope bypass               | API keys         | Medium | Scopes enforced, but need to verify check completeness |
| System ownership bypass            | System resources | Low    | Pre-populated ownedSystemIds set from DB at auth time  |
