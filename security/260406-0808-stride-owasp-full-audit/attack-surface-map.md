# Attack Surface Map — Pluralscape Full Audit

**Date:** 2026-04-06 08:08

## Entry Points

### Public (Unauthenticated)

| Method    | Path                      | Risk Profile                                            |
| --------- | ------------------------- | ------------------------------------------------------- |
| POST      | `/v1/auth/register`       | Account creation, rate limited (authHeavy)              |
| POST      | `/v1/auth/login`          | Credential verification, anti-enumeration, rate limited |
| POST      | `/v1/auth/biometric`      | Biometric auth flow                                     |
| GET       | `/v1/auth/biometric`      | Biometric challenge retrieval                           |
| POST      | `/v1/auth/password-reset` | Password reset via recovery key                         |
| POST      | `/v1/auth/recovery-key`   | Recovery key operations                                 |
| GET       | `/v1/healthcheck`         | Health endpoint                                         |
| WebSocket | `/v1/sync`                | Sync relay (auth in first message)                      |

### Authenticated (Session Required)

| Method         | Path                       | Risk Profile                                                                  |
| -------------- | -------------------------- | ----------------------------------------------------------------------------- |
| GET/DELETE     | `/v1/auth/sessions`        | Session management                                                            |
| GET/PUT/DELETE | `/v1/account/*`            | Account operations                                                            |
| GET/POST       | `/v1/systems/`             | System CRUD                                                                   |
| ALL            | `/v1/systems/:systemId/*`  | System-scoped resources (members, groups, fields, relationships, blobs, etc.) |
| GET            | `/v1/notifications/stream` | SSE notification stream                                                       |

### tRPC Procedures (~40+ routers)

| Type          | Category  | Examples                                                                                      |
| ------------- | --------- | --------------------------------------------------------------------------------------------- |
| Public        | Auth      | `auth.register`, `auth.login`, `auth.resetPasswordWithRecoveryKey`                            |
| Protected     | Account   | `account.get`, `account.update`, `account.delete`                                             |
| Protected     | System    | `system.create`, `system.list`, `system.get`, `system.update`                                 |
| Protected     | Domain    | member, group, channel, poll, journal, fronting, webhook, blob, notification, analytics, etc. |
| System-scoped | Resources | All operations requiring systemId ownership validation                                        |

## Data Flows

### Authentication Flow

```
Client → POST /v1/auth/login (email, password)
  → Server: lookup emailHash (BLAKE2b)
  → Server: verify password (Argon2id)
  → Server: create session (random 32-byte token)
  → Server: store SHA-256(token) in sessions table
  → Client: receives plaintext token
  → Client: stores in SecureStore (mobile) / memory (web)
  → Subsequent requests: Authorization: Bearer <token>
```

### Sync Flow

```
Client → WebSocket /v1/sync
  → First message: AuthenticateRequest (session token)
  → Server: validates session, binds account
  → Client → SubmitChange/SubmitSnapshot (encrypted + signed)
  → Server: stores opaque envelope (no decryption)
  → Server → broadcasts to other connected clients
  → Client: decrypts locally, applies CRDT merge
```

### Blob Upload Flow

```
Client → tRPC blob.createUploadUrl (metadata)
  → Server: generates S3 presigned PUT URL (1h expiry)
  → Client: encrypts blob locally (XChaCha20-Poly1305)
  → Client → PUT to S3 presigned URL (encrypted bytes)
  → Client → tRPC blob.confirmUpload (checksum)
  → Server: verifies S3 object exists, stores metadata
```

### Key Rotation Flow

```
Account owner → initiate rotation for bucket
  → Server: creates rotation record (initiated state)
  → Client worker: claims items in chunks
  → Client: decrypt with old key → re-encrypt with new key
  → Client → submit re-encrypted item
  → Server: tracks progress (completedItems / totalItems)
  → All items done → rotation state = completed
```

### Device Transfer Flow

```
Source device → create transfer request (encrypted master key material)
  → Server: stores encrypted transfer payload
  → Target device → poll for transfer request
  → Target device: decrypt with shared secret
  → Target device: now has master key, can derive all sub-keys
```

## Abuse Paths

### Path 1: Session Token Theft → Account Takeover

```
Attacker steals session token (XSS, network sniff, device access)
  → Has full account access until token expires/revoked
  → Can access all owned systems, sync data, manage sessions
  Mitigations: TLS required, idle timeout, session listing/revocation
  Gap: No session binding to IP/device fingerprint
```

### Path 2: Recovery Key Compromise → Account Takeover

```
Attacker obtains recovery key (physical access, social engineering)
  → Can reset password without email verification
  → Full account takeover
  Mitigations: 52-char high-entropy key, user-managed backup
  Gap: No secondary verification for recovery key usage
```

### Path 3: Presigned URL Leakage → Blob Access

```
S3 presigned download URLs leaked (logs, referrer headers, shared links)
  → Attacker can download encrypted blobs
  → Cannot decrypt without master key (E2E encrypted)
  Mitigations: Time-limited URLs (24h), E2E encryption
  Gap: 24h window is generous; referrer leakage possible
```

### Path 4: WebSocket Auth Race

```
Connect to WebSocket before sending auth message
  → Window where unauthenticated connection exists
  → If server processes messages before auth completes...
  Mitigations: Auth required as first message, connection closed on failure
  Gap: Need to verify no messages processed before auth completes
```

### Path 5: Rate Limit Bypass via Distributed Attack

```
In-memory rate limiter (single-instance mode)
  → Different instances have separate counters
  → Distributed attack across IPs bypasses per-IP limits
  Mitigations: Valkey-backed limiter for production
  Gap: Self-hosted single-instance still uses in-memory (by design)
```

### Path 6: Email Hash Rainbow Table

```
BLAKE2b email hashes are deterministic with pepper
  → If EMAIL_HASH_PEPPER leaks, rainbow table possible
  → Per-account salt mitigates but pepper is shared
  Mitigations: 32-byte pepper, per-account salt, encrypted email column
  Gap: Pepper compromise + DB access = email recovery
```
