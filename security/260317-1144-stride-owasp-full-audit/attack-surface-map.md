# Attack Surface Map — Pluralscape

## Entry Points

### Public (Unauthenticated)

| Method | Path             | Purpose          | Risk                                             |
| ------ | ---------------- | ---------------- | ------------------------------------------------ |
| GET    | `/`              | Service status   | None                                             |
| GET    | `/health`        | Health check     | None                                             |
| POST   | `/auth/register` | Account creation | Rate-limited (authHeavy), Argon2id CPU cost      |
| POST   | `/auth/login`    | Authentication   | Rate-limited (authHeavy), anti-timing protection |

### Authenticated (Bearer token required)

| Method | Path                            | Purpose                   | Risk                                            |
| ------ | ------------------------------- | ------------------------- | ----------------------------------------------- |
| GET    | `/auth/sessions`                | List active sessions      | Paginated, scoped to accountId                  |
| DELETE | `/auth/sessions/:id`            | Revoke specific session   | Ownership check, TOCTOU gap                     |
| POST   | `/auth/logout`                  | Revoke current session    | Self-only                                       |
| POST   | `/auth/sessions/revoke-all`     | Revoke all except current | Scoped to accountId                             |
| GET    | `/auth/recovery-key/status`     | Recovery key status       | Rate-limited (authLight)                        |
| POST   | `/auth/recovery-key/regenerate` | New recovery key          | Rate-limited (authHeavy), password required     |
| GET    | `/account`                      | Account info              | Rate-limited (authLight)                        |
| POST   | `/account/email`                | Change email              | Password required, version check                |
| POST   | `/account/password`             | Change password           | Password required, revokes other sessions       |
| POST   | `/systems`                      | Create system             | Rate-limited (write), system-type accounts only |
| GET    | `/systems`                      | List systems              | Paginated, scoped to accountId                  |
| GET    | `/systems/:id`                  | Get system                | Ownership check via accountId                   |
| PUT    | `/systems/:id`                  | Update system             | Ownership check, version check                  |
| DELETE | `/systems/:id`                  | Delete/archive system     | Ownership check, dependent entity check         |

## Global Middleware Stack

```
Request → requestId → secureHeaders → CORS → bodyLimit(256KB) → globalRateLimiter → [route handlers] → errorHandler
```

Route-specific middleware applied per-group:

- `/auth/register`, `/auth/login`, `/auth/recovery-key/regenerate` → authHeavy rate limiter
- `/auth/sessions/*`, `/auth/recovery-key/status` → authLight rate limiter
- `/account/*` → authMiddleware + authLight rate limiter
- `/systems/*` → authMiddleware + write rate limiter

## Data Flows

```
Registration:
  Client → POST /auth/register → Zod parse → password length check
    → Argon2id hash + salt → KEK derivation → master key generation
    → key wrapping → identity keypair → recovery key
    → DB transaction (account + auth keys + recovery key + session)
    → session token returned

Login:
  Client → POST /auth/login → Zod parse → email hash (BLAKE2b + pepper)
    → DB lookup by emailHash → Argon2id verify (or dummy hash if not found)
    → create session in DB → session token returned

Authenticated Request:
  Client → Bearer token → auth middleware
    → validate format (sess_ + UUID)
    → DB join (sessions + accounts + systems)
    → check: not revoked, not expired, not idle-timed-out
    → set auth context (accountId, systemId, sessionId, accountType)
    → route handler → DB queries scoped to auth context

Password Change:
  Client → POST /account/password → auth middleware → Zod parse
    → verify current password → derive old KEK → unwrap master key
    → generate new salt → derive new KEK → re-wrap master key
    → DB transaction (update account + revoke all other sessions)
```

## Abuse Paths

### Path 1: Rate Limit Bucket Flooding

```
Attacker → Set X-Forwarded-For to random strings (when TRUST_PROXY=1)
  → Each unique value creates a new rate-limit bucket
  → Memory grows unbounded until MAX_RATE_LIMIT_ENTRIES (10,000) eviction triggers
  → Legitimate users' buckets may be evicted during cleanup
```

**Impact:** Low — cleanup evicts expired entries; no data exposure

### Path 2: Validation Schema Reconnaissance

```
Attacker → Send malformed requests to authenticated endpoints
  → ZodError details returned in 400 response (even in production)
  → Reveals field names, types, and validation rules
  → Aids targeted exploitation of other vectors
```

**Impact:** Medium — information disclosure aids further attacks

### Path 3: Session Revocation Race

```
Attacker (authenticated) → DELETE /auth/sessions/:id (targeting own session)
  → Concurrent request: ownership check passes (line 351)
  → Between check and transaction, another request modifies state
  → UPDATE executes with only sessionId filter
```

**Impact:** Low — sessions are immutable on accountId; worst case is double-revoke
