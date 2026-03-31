# Attack Surface Map

## Entry Points

### REST API (Hono on Bun)

#### Unauthenticated Endpoints

| Method | Path                    | Rate Limit         | Notes                                 |
| ------ | ----------------------- | ------------------ | ------------------------------------- |
| POST   | /v1/auth/register       | authHeavy (10/60s) | Idempotent, creates account + system  |
| POST   | /v1/auth/login          | authHeavy (10/60s) | Account-scoped throttle on failures   |
| POST   | /v1/auth/biometric      | authHeavy (10/60s) | One-time biometric token verification |
| POST   | /v1/auth/password-reset | authHeavy (10/60s) | Recovery key-based password reset     |
| POST   | /v1/auth/recovery-key   | authHeavy (10/60s) | Recovery key operations               |
| GET    | /health                 | none               | Health check endpoint                 |

#### Authenticated Endpoints (Bearer token)

| Method     | Path                                     | Rate Limit          | Notes                                               |
| ---------- | ---------------------------------------- | ------------------- | --------------------------------------------------- |
| GET/DELETE | /v1/auth                                 | authLight           | Session management                                  |
| GET        | /v1/account                              | authLight           | Account info                                        |
| DELETE     | /v1/account                              | write               | Account deletion                                    |
| PUT        | /v1/account/email                        | write               | Email change                                        |
| PUT        | /v1/account/password                     | authHeavy           | Password change                                     |
| GET        | /v1/account/audit-log                    | authLight           | Audit log retrieval                                 |
| POST       | /v1/account/device-transfer              | account-keyed       | Device transfer initiation                          |
| POST       | /v1/account/device-transfer/:id/approve  | write               | Transfer approval                                   |
| POST       | /v1/account/device-transfer/:id/complete | code-keyed          | Transfer completion                                 |
| PUT        | /v1/account/settings                     | write               | Account settings                                    |
| POST       | /v1/account/pin                          | write               | PIN management                                      |
| \*         | /v1/account/friends/\*                   | write               | Friend management                                   |
| \*         | /v1/account/friend-codes/\*              | write               | Friend code management                              |
| \*         | /v1/systems/:systemId/\*                 | write               | All system operations (CRUD for 20+ resource types) |
| POST       | /v1/systems/:systemId/blobs/upload-url   | blobUpload (10/60s) | Presigned upload URL                                |
| GET        | /v1/systems/:systemId/blobs/download-url | authLight           | Presigned download URL                              |
| \*         | /v1/systems/:systemId/api-keys/\*        | write               | API key management                                  |
| \*         | /v1/systems/:systemId/webhook-configs/\* | write               | Webhook configuration                               |

### WebSocket

| Path        | Auth                   | Notes                                                      |
| ----------- | ---------------------- | ---------------------------------------------------------- |
| /v1/sync/ws | Token in first message | Origin validation, 10s auth timeout, connection rate limit |

### SSE (Server-Sent Events)

| Path              | Auth         | Notes                        |
| ----------------- | ------------ | ---------------------------- |
| /v1/notifications | Bearer token | Per-account connection limit |

## Data Flows

### Authentication Flow

```
Client → POST /auth/login (email + password)
  → Zod validation → Email hash lookup → Argon2id verify
  → Anti-enum timing equalization → Login throttle check
  → Session token generation (32 bytes random)
  → Token hash stored (BLAKE2b) → Raw token returned to client
```

### Registration Flow

```
Client → POST /auth/register (email, password, recovery key confirmation)
  → Idempotency check → Zod validation
  → Key generation (master key, identity keypair, KDF salt)
  → Password hash (Argon2id) → Email hash (BLAKE2b + pepper)
  → Encrypted email storage → Account + system creation
  → Recovery key generation → Session creation
  → Memory zeroing of all key material
```

### Webhook Dispatch Flow

```
System mutation → Webhook dispatcher
  → Config cache check → Filter subscribed configs
  → Payload construction → Optional encryption (XChaCha20-Poly1305)
  → Delivery record creation → Queue for async delivery
  → URL validation (SSRF check with IP pinning)
  → HMAC-signed HTTP POST → Delivery status update
```

### Sync Flow (WebSocket)

```
Client → WS upgrade (origin validation + rate limit)
  → Auth message (session token) → 10s timeout
  → Protocol negotiation (version check)
  → Encrypted CRDT changes → Signature verification
  → Document ownership check → Broadcast to subscribers
```

### Friend Access Flow

```
Friend code redemption → Cross-account transaction
  → Code validation (expiry, usage count, self-redemption check)
  → Connection creation (bidirectional)
  → Bucket assignment → Key grant creation
  → Friend dashboard read (READ ONLY mode, bucket-scoped)
```

## Abuse Paths

### Path 1: Account Takeover via Recovery Key

```
Attacker obtains recovery key (shoulder surfing, backup compromise)
  → POST /auth/password-reset (no auth required)
  → New password set → All sessions revoked → Attacker session created
  → Full account access
```

**Mitigation:** Recovery key is 256-bit random (base32), displayed only once at registration. Rate limiting on password-reset endpoint.

### Path 2: Session State Information Leakage

```
Attacker has stolen/expired session token
  → GET /v1/account (with expired token)
  → Response: SESSION_EXPIRED (vs UNAUTHENTICATED for invalid)
  → Attacker learns: token was valid but expired (not revoked)
```

**Mitigation:** Both return 401, but error code differs. Impact is informational only.

### Path 3: Webhook URL as SSRF Vector

```
Attacker creates webhook config with internal URL
  → POST /v1/systems/:id/webhook-configs (authenticated)
  → URL validation: private IP check + DNS resolution + IP pinning
  → BLOCKED: resolveAndValidateUrl() rejects private/reserved IPs
```

**Mitigation:** Multi-layer SSRF protection (IP blocklist, DNS validation, IP pinning).

### Path 4: Friend Code Brute Force

```
Attacker guesses friend codes
  → POST /v1/account/friend-codes/redeem
  → Code format: system-generated, random
  → Rate limited (write category: 30/60s)
```

**Mitigation:** Codes are random, rate-limited, and can have usage limits + expiry.
