# Attack Surface Map — Pluralscape Full Audit

**Date:** 2026-04-14

## Entry Points

### REST API (Hono)

| Method              | Path                                     | Auth            | Rate Limit              | Notes                                 |
| ------------------- | ---------------------------------------- | --------------- | ----------------------- | ------------------------------------- |
| POST                | `/v1/auth/register`                      | None            | authHeavy               | Anti-enum timing                      |
| POST                | `/v1/auth/login`                         | None            | authHeavy               | Per-account throttle (10/15min)       |
| POST                | `/v1/auth/biometric`                     | None            | authHeavy               | Biometric challenge                   |
| POST                | `/v1/auth/password-reset/recovery-key`   | None            | authHeavy + per-account | Anti-enum timing                      |
| GET/POST/PUT/DELETE | `/v1/account/*`                          | Session         | global                  | Account management                    |
| GET/POST/PUT/DELETE | `/v1/systems/:systemId/*`                | Session/API Key | global                  | System CRUD, scope-gated for API keys |
| POST                | `/v1/systems/:systemId/blobs/upload-url` | Session         | blobUpload              | Signed URL generation                 |
| GET                 | `/v1/notifications/stream`               | Session         | sseStream               | SSE, 3 connections/account            |

### tRPC (`/v1/trpc/*`)

- 50+ procedures across 30+ routers
- Protected procedures via `protectedProcedure` middleware
- All input validated with Zod schemas
- Scope-gated for API key access (fail-closed)

### WebSocket (`/v1/sync/ws`)

- Subprotocol: `pluralscape-sync-v1`
- Auth: Session token in first `AuthenticateRequest` message (10s timeout)
- Limits: 500 global unauthed, 50/IP unauthed, 10/account authed
- Message: 5 MB max, 100 mutations/10s, 200 reads/10s
- Strike system: 10 rate-limit violations → connection closed

## Data Flows

```
User Input → Zod Validation → Drizzle ORM → PostgreSQL (RLS)
                                    ↕
                              Valkey (rate limits, pub/sub)
                                    ↕
                              S3/Filesystem (blobs)

Client-Side Encryption:
  Plaintext → XChaCha20-Poly1305 (bucket key) → API → PostgreSQL
  (Server never sees plaintext member/system data)

Email Flow:
  Email → normalize → BLAKE2b-256 (pepper) → emailHash column
  Email → normalize → XChaCha20-Poly1305 → encryptedEmail column

Session Flow:
  Login → Argon2id verify → 32-byte random token → BLAKE2b hash → DB
  Request → Bearer token → BLAKE2b hash → DB lookup → validate expiry/idle/revoked

Webhook Flow:
  Event → encrypt payload (optional) → queue delivery → DNS resolve → SSRF check
  → IP-pinned fetch → HMAC-SHA256 sign → POST → verify 2xx → mark success
```

## Abuse Paths

### Path 1: Multi-Instance Rate Limit Bypass (Low)

```
Attacker → distribute login attempts across N instances (no Valkey)
→ each instance has independent 10-attempt window
→ effective brute force rate = N × 10 attempts / 15 min
```

**Requires:** Multi-instance deployment without Valkey for login throttle

### Path 2: Memory Exhaustion via Import (Medium)

```
Attacker → upload crafted 500MB SP export JSON
→ file-source.ts materializes full tree (~1.5 GB RAM)
→ potential OOM on constrained server
```

**Requires:** Authenticated user with import access

### Path 3: Unbounded Entity Creation (Medium)

```
Attacker → create millions of notes/innerworld entities
→ no per-system quota check on these entity types
→ database/sync storage exhaustion
```

**Requires:** Authenticated user with system access

### Path 4: Error Message Intelligence Gathering (Low)

```
Attacker → trigger API errors from mobile client
→ rest-query-factory.ts:58 stringifies raw API error JSON
→ learn internal API structure, error codes, field names
```

**Requires:** Access to mobile app (public)
