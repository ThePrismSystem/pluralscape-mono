# Attack Surface Map — Pluralscape

## Entry Points

### Public (No Auth Required)

| Method | Path                                   | Risk Profile                                      |
| ------ | -------------------------------------- | ------------------------------------------------- |
| GET    | `/`                                    | Health check — minimal risk                       |
| GET    | `/health`                              | Health check — minimal risk                       |
| POST   | `/v1/auth/register`                    | Account creation — brute force, enumeration       |
| POST   | `/v1/auth/login`                       | Authentication — credential stuffing, brute force |
| POST   | `/v1/auth/biometric/verify`            | Biometric auth — replay, brute force              |
| POST   | `/v1/auth/password-reset/recovery-key` | Password reset — enumeration, abuse               |
| GET    | `/v1/sync/ws`                          | WebSocket upgrade — connection flood, auth bypass |

### Authenticated — Account Scope

| Method | Path                               | Risk Profile                             |
| ------ | ---------------------------------- | ---------------------------------------- |
| GET    | `/v1/account`                      | Account info — info disclosure           |
| POST   | `/v1/account/email`                | Email change — account takeover chain    |
| POST   | `/v1/account/password`             | Password change — account takeover chain |
| GET    | `/v1/account/audit-log`            | Audit log — info disclosure, PII         |
| POST   | `/v1/account/device-transfer`      | Device transfer — code brute force       |
| POST   | `/v1/account/settings`             | Settings — privilege manipulation        |
| POST   | `/v1/auth/biometric/enroll`        | Biometric enrollment — replay attack     |
| GET    | `/v1/auth/recovery-key/status`     | Recovery key status — info disclosure    |
| POST   | `/v1/auth/recovery-key/regenerate` | Recovery key regen — requires password   |
| GET    | `/v1/auth/sessions`                | Session list — info disclosure           |
| DELETE | `/v1/auth/sessions/:id`            | Session revocation — IDOR                |
| POST   | `/v1/auth/logout`                  | Logout — session invalidation            |
| GET    | `/v1/notifications/stream`         | SSE stream — connection exhaustion       |

### Authenticated — System Scope (/:systemId prefix)

| Method | Path Pattern                                       | Risk Profile                               |
| ------ | -------------------------------------------------- | ------------------------------------------ |
| CRUD   | `/v1/systems/`                                     | System management — IDOR, ownership bypass |
| CRUD   | `/v1/systems/:systemId/members`                    | Member management — cross-system access    |
| CRUD   | `/v1/systems/:systemId/groups`                     | Group management — IDOR                    |
| CRUD   | `/v1/systems/:systemId/fields`                     | Custom fields — data exfiltration          |
| CRUD   | `/v1/systems/:systemId/relationships`              | Relationships — privacy boundary           |
| GET    | `/v1/systems/:systemId/fronting`                   | Active fronting — real-time state          |
| CRUD   | `/v1/systems/:systemId/fronting-sessions`          | Fronting sessions — privacy-critical       |
| CRUD   | `/v1/systems/:systemId/fronting-reports`           | Reports — aggregated data                  |
| CRUD   | `/v1/systems/:systemId/custom-fronts`              | Custom fronts — user data                  |
| CRUD   | `/v1/systems/:systemId/innerworld`                 | Innerworld — deeply personal data          |
| CRUD   | `/v1/systems/:systemId/blobs`                      | Blob management — file access              |
| POST   | `/v1/systems/:systemId/blobs/upload-url`           | Presigned upload — abuse potential         |
| GET    | `/v1/systems/:systemId/blobs/:blobId/download-url` | Presigned download — IDOR                  |
| CRUD   | `/v1/systems/:systemId/webhook-configs`            | Webhook config — SSRF potential            |
| GET    | `/v1/systems/:systemId/webhook-deliveries`         | Delivery logs — info disclosure            |
| CRUD   | `/v1/systems/:systemId/analytics`                  | Analytics — data aggregation               |
| CRUD   | `/v1/systems/:systemId/timer-configs`              | Timers — abuse potential                   |
| CRUD   | `/v1/systems/:systemId/check-in-records`           | Check-ins — privacy-critical               |
| CRUD   | `/v1/systems/:systemId/lifecycle-events`           | Lifecycle events — sensitive               |
| POST   | `/v1/systems/:systemId/buckets/rotations/*`        | Key rotation — crypto operations           |
| CRUD   | `/v1/systems/:systemId/settings`                   | System settings — PIN operations           |
| CRUD   | `/v1/systems/:systemId/nomenclature`               | Nomenclature — personalization             |

## Data Flows

```
User Input → JSON Body → parseJsonBody() → Zod validation → Service layer → Drizzle ORM → PostgreSQL
                                                                                    ↓
                                                                              RLS Policy Check
                                                                              (account_id + system_id)

File Upload → Presigned URL → S3/MinIO → (encrypted by client before upload)
                                    ↓
                              Blob metadata → PostgreSQL (checksum, size, type)

WebSocket → Origin check → Subprotocol → Auth timeout → Token validation → CRDT sync
                                                                    ↓
                                                              PostgreSQL (via RLS)

Webhook → Event trigger → Sign payload (HMAC-SHA256) → HTTP POST → External URL
```

## Abuse Paths

### Path 1: Account Takeover Chain

```
Email enumeration (register) → Credential stuffing (login) → Session hijack → Full access
Mitigations: Anti-enum timing, authHeavy rate limit, session hash-only storage
```

### Path 2: Cross-Account Data Access (IDOR)

```
Authenticate as Account A → Guess/enumerate systemId for Account B → Access data
Mitigations: RLS policies, systemId ownership check, UUID-based IDs
```

### Path 3: Webhook SSRF

```
Create webhook config → Set URL to internal service → Trigger webhook → Access internal network
Mitigations: TBD — need to check URL validation
```

### Path 4: WebSocket Auth Race

```
Open WS connection → Send messages before auth → Access sync data
Mitigations: Auth timeout, message validation, pre-auth state machine
```

### Path 5: Presigned URL Abuse

```
Generate upload URL → Upload malicious content → Share download URL → Content serves from trusted domain
Mitigations: Content encrypted by client (zero-knowledge), size limits
```

### Path 6: Recovery Key Brute Force

```
Obtain email → Attempt password reset with recovery key guesses → Account takeover
Mitigations: 256-bit recovery key (infeasible brute force), rate limiting on reset endpoint
```

### Path 7: Device Transfer Code Brute Force

```
Initiate transfer → Brute force 10-digit code → Steal master key
Mitigations: 5-min TTL, Argon2id derivation (~2800 GPU hours), rate limiting
```
