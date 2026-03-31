# API Consumer Guide

> Audience: developers building the Expo mobile client (M8), internal contributors, and external integrators.

## Table of Contents

1. [Overview](#1-overview)
2. [Authentication](#2-authentication)
3. [Encryption Lifecycle](#3-encryption-lifecycle)
4. [REST Conventions](#4-rest-conventions)
5. [CRUD Patterns](#5-crud-patterns)
6. [Sync Protocol](#6-sync-protocol)
7. [Webhooks](#7-webhooks)
8. [Domain-Specific Patterns](#8-domain-specific-patterns)
   - [8.1 Fronting](#81-fronting)
   - [8.2 Communication](#82-communication)
   - [8.3 Privacy Buckets](#83-privacy-buckets)
   - [8.4 Friend Network](#84-friend-network)
   - [8.5 Push Notifications](#85-push-notifications)
9. [Self-Hosted Considerations](#9-self-hosted-considerations)

---

## 1. Overview

Pluralscape exposes a REST API built on **Hono** running on **Bun**. All versioned endpoints live under the `/v1/` prefix. The route tree is:

```
/v1/auth/*           Authentication (register, login, sessions, biometric, recovery, password reset)
/v1/account/*        Account management (profile, email, password, device transfer, friends, audit log)
/v1/systems/*        System and member CRUD, fronting, groups, custom fields, innerworld, etc.
/v1/notifications/*  Notification stream (SSE)
/v1/sync/ws          WebSocket sync endpoint
```

The OpenAPI spec is at `docs/openapi.yaml`.

### Zero-Knowledge Architecture

The server is **zero-knowledge**: it stores ciphertext and metadata, never plaintext user data. All encryption and decryption happens on the client. The server cannot read member names, descriptions, journal entries, or any other T1/T2 content. It can only see structural metadata (timestamps, IDs, sort orders, archived flags).

This means:

- The server cannot implement full-text search over encrypted fields.
- Password reset cannot use email-based verification (the server needs the password-derived key to unwrap the master key).
- API responses return encrypted blobs that the client must decrypt before display.

### Encryption Tiers

All data fields fall into one of three tiers:

| Tier   | Name           | Key                     | Shareable         | Examples                                                                 |
| ------ | -------------- | ----------------------- | ----------------- | ------------------------------------------------------------------------ |
| **T1** | Account-scoped | Master key (per-system) | No                | Member names, pronouns, descriptions, journal entries, fronting comments |
| **T2** | Bucket-scoped  | Bucket key (per-bucket) | Yes, with friends | Fields tagged with a privacy bucket for friend sharing                   |
| **T3** | Plaintext      | None (server-readable)  | N/A               | Timestamps, sort orders, archived flags, webhook secrets                 |

T1 is the default tier for sensitive data. T2 extends T1 by allowing controlled sharing via privacy buckets (see ADR 006). T3 is reserved for structural metadata that the server needs to perform queries and enforce business logic.

---

## 2. Authentication

All auth routes are under `/v1/auth/`. Auth responses include `Cache-Control: no-store` to prevent caching of tokens and key material.

### 2.1 Registration

```
POST /v1/auth/register
```

**Request body:**

```json
{
  "email": "user@example.com",
  "password": "strongpassword123",
  "recoveryKeyBackupConfirmed": true,
  "accountType": "system"
}
```

- `password`: minimum 8 characters, maximum length enforced to prevent Argon2 DoS.
- `recoveryKeyBackupConfirmed`: must be `true` -- the client must display the recovery key and confirm the user has saved it before submitting.
- `accountType`: `"system"` (default) or `"viewer"`. A `"system"` account creates a system entity alongside the account.

**Server-side processing:**

1. Hash the email with BLAKE2b (peppered) for lookup.
2. Hash the password with Argon2id (server profile: 4 iterations, 64 MiB).
3. Generate a random 256-bit master key (not derived from password).
4. Derive a password key (KEK) from the password via Argon2id, wrap the master key.
5. Derive identity keypairs (X25519 + Ed25519) from the master key.
6. Encrypt identity private keys under the master key.
7. Generate a 256-bit recovery key, encrypt the master key under it.
8. Store everything in a single transaction.

**Response (201 Created):**

```json
{
  "data": {
    "sessionToken": "ps_sess_...",
    "recoveryKey": "ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567-ABCD-EFGH-IJKL-MNOP-QRST",
    "accountId": "acct_...",
    "accountType": "system"
  }
}
```

The `recoveryKey` is displayed exactly once. The client must present it to the user for offline storage. It is 52 base32 characters in 13 groups of 4, separated by dashes.

**Anti-enumeration:** duplicate email registrations return a fake success response with identical shape and timing to prevent email harvesting.

**Rate limiting:** `authHeavy` category. Idempotency middleware is active.

### 2.2 Login

```
POST /v1/auth/login
```

**Request body:**

```json
{
  "email": "user@example.com",
  "password": "strongpassword123"
}
```

**Response (200 OK):**

```json
{
  "data": {
    "sessionToken": "ps_sess_...",
    "accountId": "acct_...",
    "systemId": "sys_...",
    "accountType": "system"
  }
}
```

**Failure responses:**

- `401 UNAUTHENTICATED`: generic "Invalid email or password" (no user enumeration).
- `429 LOGIN_THROTTLED`: too many failed attempts for this account. Response includes `Retry-After` header.

**Anti-timing:** when an email is not found, the server verifies the password against a dummy Argon2id hash to equalize response times with real accounts.

**Rate limiting:** `authHeavy` category. Per-account login attempt tracking with lockout window.

### 2.3 Session Management

Sessions are bearer-token authenticated. Include the token in the `Authorization` header:

```
Authorization: Bearer ps_sess_...
```

**Session timeouts:**

| Platform        | Absolute TTL | Idle Timeout |
| --------------- | ------------ | ------------ |
| Web             | 30 days      | 7 days       |
| Mobile          | 90 days      | 30 days      |
| Device transfer | 5 minutes    | None         |

The client signals its platform via the `X-Client-Platform` header (`web` or `mobile`). If omitted, defaults to `web`.

**Concurrent sessions:** maximum 50 per account. When exceeded, the oldest session is evicted.

**Endpoints:**

```
GET  /v1/auth/sessions                List active sessions (paginated, default 25, max 100)
DELETE /v1/auth/sessions/:id          Revoke a specific session (cannot revoke current -- use logout)
POST /v1/auth/logout                  Revoke the current session
POST /v1/auth/sessions/revoke-all     Revoke all sessions except current
```

### 2.4 Biometric Token Enrollment

Requires an active session.

```
POST /v1/auth/biometric/enroll     Enroll a biometric credential (201 Created)
POST /v1/auth/biometric/verify     Verify a biometric credential
```

On mobile, the master key is cached in the OS secure store (Keychain/Keystore) behind biometric authentication. Biometric enrollment registers a server-side credential that the client uses to prove biometric unlock occurred, without transmitting the master key.

### 2.5 Password Reset via Recovery Key

There is no email-based password reset. Because the server is zero-knowledge, it cannot verify account ownership without the password-derived key. The only reset path is the recovery key, which the user stored at registration.

```
POST /v1/auth/password-reset/recovery-key
```

**Request body:**

```json
{
  "email": "user@example.com",
  "recoveryKey": "ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567-ABCD-EFGH-IJKL-MNOP-QRST",
  "newPassword": "newstrongpassword456"
}
```

**Response (200 OK):**

```json
{
  "data": {
    "sessionToken": "ps_sess_...",
    "recoveryKey": "NEW-RECO-VERY-KEY-...",
    "accountId": "acct_..."
  }
}
```

The server decrypts the master key using the recovery key, re-wraps it under the new password-derived key, generates a new recovery key, and returns a new session. The old recovery key is invalidated.

**Failure:** returns `401 UNAUTHENTICATED` for any error (wrong email, wrong recovery key, no active recovery key) to prevent enumeration.

### 2.6 Recovery Key Management

Requires an active session.

```
GET  /v1/auth/recovery-key/status       Check if a recovery key exists
POST /v1/auth/recovery-key/regenerate   Generate a new recovery key (requires current password)
```

Regeneration invalidates the previous recovery key and sends an email notification (fire-and-forget).

### 2.7 Device Transfer

Device transfer moves the encrypted master key from an existing device to a new one. The flow is:

1. **Source device initiates** (authenticated):

   ```
   POST /v1/account/device-transfer
   ```

   Request body:

   ```json
   {
     "codeSaltHex": "<32 hex chars>",
     "encryptedKeyMaterialHex": "<hex-encoded encrypted master key>"
   }
   ```

   The client generates a 10-digit verification code, derives a transfer key from it via Argon2id (mobile profile: 2 iterations, 32 MiB), encrypts the master key with the transfer key, and sends the encrypted blob to the server.

   Response (201 Created):

   ```json
   {
     "data": {
       "transferId": "...",
       "expiresAt": 1234567890
     }
   }
   ```

2. **Source device approves** (from the same session that initiated):

   ```
   POST /v1/account/device-transfer/:id/approve
   ```

   Returns `204 No Content`.

3. **Target device completes** (authenticated on the target device):
   ```
   POST /v1/account/device-transfer/:id/complete
   ```
   Request body:
   ```json
   {
     "code": "1234567890"
   }
   ```
   The server returns the encrypted key material. The target device derives the same transfer key from the code + salt (via Argon2id) and decrypts the master key.

**Security controls:**

- Transfer sessions expire after **5 minutes** (`TRANSFER_TIMEOUT_MS`).
- Maximum **5 code attempts** per transfer.
- Maximum **3 transfer initiations** per account per hour.
- The 10-digit code provides ~33.2 bits of entropy, protected by Argon2id key stretching. Offline brute-force of the full code space would take ~2,800 hours on a high-end GPU (see ADR 024).

**QR code alternative:** the crypto package supports encoding the transfer initiation (request ID, code, salt) as a JSON QR payload for scanning instead of manual code entry.

---

## 3. Encryption Lifecycle

This section describes the full key hierarchy and encryption operations a client must implement. All cryptographic primitives come from libsodium (see ADR 006).

### 3.1 Key Derivation

The system uses a **KEK/DEK** (Key Encryption Key / Data Encryption Key) pattern:

```
Password + Salt
  --> Argon2id --> Password Key (KEK, 256-bit)
                     |
                     +--> wraps/unwraps Master Key (DEK)

Master Key (256-bit, random, persistent)
  --> KDF(subkey=1, ctx="identity") --> X25519 seed --> Encryption keypair
  --> KDF(subkey=2, ctx="identity") --> Ed25519 seed --> Signing keypair
  --> KDF(subkey=3, ctx="identity") --> Private key encryption key
  --> KDF(subkey=1, ctx="bktkeywp") --> Bucket key wrapping key
```

**The master key is NOT derived from the password.** It is a random 256-bit value generated at registration and persisted (encrypted) in the database. This means password changes do not invalidate derived keys -- only the KEK wrapping layer is re-encrypted.

**Argon2id profiles:**

| Profile | Iterations                      | Memory                                 | Use Case                                              |
| ------- | ------------------------------- | -------------------------------------- | ----------------------------------------------------- |
| Server  | 4 (`PWHASH_OPSLIMIT_SENSITIVE`) | 64 MiB (`PWHASH_MEMLIMIT_INTERACTIVE`) | Registration, login, password reset (server-side)     |
| Mobile  | 2 (`PWHASH_OPSLIMIT_MOBILE`)    | 32 MiB (`PWHASH_MEMLIMIT_MOBILE`)      | Device transfer key derivation, mobile key derivation |

The server profile meets OWASP Sensitive tier requirements (m=65536, t>=4, p=1).

**Salt:** 16 bytes (`PWHASH_SALT_BYTES`), generated randomly at registration, stored as hex in `accounts.kdfSalt`.

### 3.2 Identity Keypairs

Two keypairs are derived deterministically from the master key via BLAKE2B-based KDF:

| Keypair    | Algorithm | KDF Context  | Subkey ID | Purpose                                                      |
| ---------- | --------- | ------------ | --------- | ------------------------------------------------------------ |
| Encryption | X25519    | `"identity"` | 1         | Asymmetric key exchange (receiving bucket keys from friends) |
| Signing    | Ed25519   | `"identity"` | 2         | Digital signatures (authenticating sync operations)          |

Both keypairs are derived from 32-byte seeds, making them deterministic from the master key. The private keys are also encrypted under a third sub-key (subkey 3, context `"identity"`) and stored on the server for backup.

Public keys are serialized as base64url (no padding) for server storage and directory lookup.

**Key sizes:**

| Component          | Size     |
| ------------------ | -------- |
| X25519 public key  | 32 bytes |
| X25519 secret key  | 32 bytes |
| Ed25519 public key | 32 bytes |
| Ed25519 secret key | 64 bytes |
| Ed25519 signature  | 64 bytes |

### 3.3 Bucket Key Model

A **privacy bucket** is a named container that controls which friends can see tagged data. Each bucket has its own symmetric key.

**Key lifecycle:**

1. **Creation:** client generates a random 256-bit symmetric key (`crypto_aead_keygen`).
2. **Storage:** the bucket key is wrapped (encrypted) under the master key using the `"bktkeywp"` KDF context (subkey 1) and stored on the server as a `WrappedBucketKey` (ciphertext + nonce + keyVersion).
3. **Usage:** client unwraps the bucket key via the master key, then uses it to encrypt/decrypt tagged fields with XChaCha20-Poly1305.
4. **Sharing:** when a friend is granted bucket access, the client encrypts the bucket key with the friend's X25519 public key (`crypto_box`) and stores the encrypted key grant on the server. The friend's device fetches the grant, decrypts with their private key, and caches the bucket key.
5. **Rotation:** when a friend is removed, the bucket key is rotated (see section 3.6).

### 3.4 Encryption Tiers in Detail

**T1 -- Account-scoped (zero-knowledge):**

- Encrypted with the master key (or a sub-key derived from it).
- Never shared. Only the system owner can decrypt.
- Used for: member names, pronouns, descriptions, tags, colors, avatar sources, fronting comments, journal content, group names, custom front names, innerworld entities, and more.
- Wire format: `T1EncryptedBlob` with `tier: 1`, `keyVersion: null`, `bucketId: null`.

**T2 -- Bucket-scoped (shareable):**

- Encrypted with a bucket-specific symmetric key.
- Shareable with friends who have been granted the bucket key.
- Used for: any field tagged with a privacy bucket for selective friend visibility.
- Wire format: `T2EncryptedBlob` with `tier: 2`, a `bucketId`, and a `keyVersion`.
- During key rotation, clients must support dual-key reads (check `keyVersion` to select the correct key).

**T3 -- Plaintext (server-readable):**

- Not encrypted. The server can read, index, and query these fields.
- Used for: timestamps (`createdAt`, `updatedAt`), sort orders, archived flags, webhook secrets, session metadata.
- No `EncryptedBlob` wrapper -- fields appear as plain types.

### 3.5 Per-Field Encryption

Individual fields are encrypted using **XChaCha20-Poly1305 AEAD**:

- **Key size:** 256-bit (32 bytes, `AEAD_KEY_BYTES`).
- **Nonce:** 192-bit (24 bytes, `AEAD_NONCE_BYTES`), generated randomly for each encryption operation. The large nonce space makes random nonce collisions negligible.
- **Auth tag:** 128-bit (16 bytes, `AEAD_TAG_BYTES`), appended to the ciphertext by the AEAD construction.
- **Algorithm identifier:** `"xchacha20-poly1305"` (the only supported algorithm).

**Wire format for encrypted blobs:**

```typescript
interface EncryptedBlobBase {
  ciphertext: Uint8Array; // Encrypted data + AEAD tag
  nonce: Uint8Array; // 24-byte random nonce
  algorithm: "xchacha20-poly1305";
  keyVersion: number | null;
}
```

The `encrypt()` function produces `{ ciphertext, nonce }`. The `decrypt()` function takes the same payload and the key, returning the plaintext. Optional associated data (AAD) can be passed for context binding but is not currently used for field-level encryption.

**JSON field encryption:** the `encryptJSON()` / `decryptJSON()` helpers serialize values to JSON, encode as UTF-8, and encrypt/decrypt the byte representation.

### 3.6 Key Rotation

Key rotation follows the **lazy rotation protocol** defined in ADR 014. It separates security-critical revocation (instant) from expensive re-encryption (background, client-driven).

**Rotation state machine:**

```
revoke_friend --> [initiated] --> first chunk claimed --> [migrating]
  --> all items done --> [sealing] --> old key purged --> [completed]
                                                      --> [failed] (7-day timeout)
```

**Rotation flow:**

1. **Initiation (synchronous, <2s):** generate new bucket key, increment `keyVersion`, wrap under master key, revoke old key grants for the removed friend, issue new grants to remaining friends, create rotation ledger entry, populate rotation items.
2. **Migration (async, client-driven):** owner's devices claim chunks of pending items (default 50 per chunk), fetch encrypted blobs, decrypt with old key, re-encrypt with new key, upload with new `keyVersion`. Multiple devices can work concurrently.
3. **Sealing:** when all items are processed, the server re-scans for items added during migration, verifies the accounting invariant (`completedItems + failedItems == totalItems`), and either purges the old key (`completed`) or preserves it (`failed`).

**Key points for client implementors:**

- All new writes use the new key immediately after initiation.
- During `initiated` and `migrating` states, clients must cache both old and new bucket keys and check `keyVersion` on each blob to select the correct key.
- Chunk claims use compare-and-swap (CAS). Stale claims (>5 minutes) are automatically reset for other devices to reclaim.
- If an offline device comes online with writes encrypted under the old key, the server rejects with `key-version-stale`. The client must re-encrypt with the current key and retry.
- Single-item failures (after 3 attempts) are marked `failed` but do not block the rotation.
- The hard time limit is 7 days from initiation. If exceeded, the rotation enters `failed` state and the old key is preserved (data accessibility over security).
- Failed rotations are automatically retried on the next device session.

### 3.7 Recovery Key

The recovery key is the only way to regain access if the password is lost. There is no email-based reset because the server cannot verify identity without the password-derived key.

**Structure:**

- 256 bits of random data.
- Encoded as 52 unpadded base32 characters (A-Z, 2-7), displayed as 13 groups of 4 separated by dashes: `ABCD-EFGH-IJKL-MNOP-...`.
- The raw bytes are used directly as a 256-bit AEAD key to encrypt the master key.
- The encrypted master key blob is stored on the server in the `recovery_keys` table.

**Recovery flow:**

1. User provides email + recovery key + new password.
2. Server looks up the account by email hash, retrieves the encrypted master key blob from `recovery_keys`.
3. Server decodes the recovery key from base32, uses it as an AEAD key to decrypt the master key.
4. Server derives a new password key (KEK) from the new password, re-wraps the master key.
5. Server generates a new recovery key, encrypts the master key under it, replaces the old recovery key record.
6. Server returns a new session token and the new recovery key.

**The old recovery key is invalidated.** The user must store the new one.

**Regeneration** (without password reset) is also available via `POST /v1/auth/recovery-key/regenerate`, which requires the current password and generates a fresh recovery key + encrypted master key blob.

---

## 4. REST Conventions

### 4.1 Response Envelope

All success responses wrap the payload in a `{ data }` envelope:

```json
{
  "data": { ... }
}
```

Paginated list responses return `PaginatedResult` directly (not nested under `data`):

```json
{
  "data": [ ... ],
  "nextCursor": "eyJpZ...",
  "hasMore": true,
  "totalCount": null
}
```

Error responses use a distinct shape (see section 4.3). The discriminant is the presence of `data` (success) versus `error` (failure) -- they are never both present.

### 4.2 Pagination

All list endpoints use **cursor-based keyset pagination**. Cursors are opaque, HMAC-signed, base64url-encoded strings with a server-side TTL of 24 hours. Do not attempt to parse or construct them.

**Query parameters:**

| Parameter | Type    | Default  | Max | Description                                |
| --------- | ------- | -------- | --- | ------------------------------------------ |
| `limit`   | integer | 25       | 100 | Number of items per page                   |
| `cursor`  | string  | _(none)_ | --  | Opaque cursor from a previous `nextCursor` |

**Response shape:**

```json
{
  "data": [ ... ],
  "nextCursor": "eyJpZ..." | null,
  "hasMore": true | false,
  "totalCount": null
}
```

- `nextCursor` is `null` when there are no more results.
- `hasMore` mirrors `nextCursor !== null` for convenience.
- `totalCount` is `null` for most endpoints (expensive to compute with keyset pagination). When present, it is capped at 100,000 rows.

**Errors:**

- `400 INVALID_CURSOR` -- the cursor is malformed or expired (TTL: 24 hours). Discard the cursor and restart from the first page.

Some endpoints use **composite cursors** that encode both a sort value (e.g., timestamp) and entity ID for stable ordering across pages. The wire format is identical -- the cursor is still an opaque string.

### 4.3 Error Responses

All errors return a structured body:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": { ... }
  },
  "requestId": "uuid"
}
```

In production, 5xx errors have their `message` masked to `"Internal Server Error"` and `details` stripped. In development, the original message and details are preserved for debugging.

**HTTP status mapping:**

| Status      | Default Code             | Meaning                                                              |
| ----------- | ------------------------ | -------------------------------------------------------------------- |
| 400         | `VALIDATION_ERROR`       | Malformed request body, invalid parameters                           |
| 401         | `UNAUTHENTICATED`        | Missing or invalid session token                                     |
| 403         | `FORBIDDEN`              | Valid session but insufficient permissions                           |
| 404         | `NOT_FOUND`              | Entity does not exist or is not visible                              |
| 405         | `VALIDATION_ERROR`       | Method not allowed                                                   |
| 409         | `CONFLICT`               | Generic conflict (see also `HAS_DEPENDENTS`, `IDEMPOTENCY_CONFLICT`) |
| 413         | `BLOB_TOO_LARGE`         | Upload exceeds per-purpose size limit                                |
| 415         | `UNSUPPORTED_MEDIA_TYPE` | Content type not accepted                                            |
| 422         | `VALIDATION_ERROR`       | Semantic validation failure                                          |
| 429         | `RATE_LIMITED`           | Rate limit exceeded                                                  |
| 500         | `INTERNAL_ERROR`         | Unexpected server error                                              |
| 502/503/504 | `SERVICE_UNAVAILABLE`    | Upstream dependency failure                                          |

**Error codes reference:**

The full set of error codes is defined in `@pluralscape/types` (`API_ERROR_CODES`). Key domain-specific codes:

| Code                   | Status | When                                                                  |
| ---------------------- | ------ | --------------------------------------------------------------------- |
| `HAS_DEPENDENTS`       | 409    | Delete blocked because entity has dependent records                   |
| `IDEMPOTENCY_CONFLICT` | 409    | A request with the same idempotency key is already in flight          |
| `ROTATION_IN_PROGRESS` | 409    | Bucket key rotation prevents the operation                            |
| `KEY_VERSION_STALE`    | 409    | Write rejected because key version is outdated (re-encrypt and retry) |
| `SESSION_EXPIRED`      | 401    | Session exceeded its absolute TTL or idle timeout                     |
| `LOGIN_THROTTLED`      | 429    | Too many failed login attempts for this account                       |
| `ALREADY_ARCHIVED`     | 409    | Entity is already archived                                            |
| `NOT_ARCHIVED`         | 409    | Cannot restore an entity that is not archived                         |
| `SCOPE_INSUFFICIENT`   | 403    | API key lacks the required scope                                      |
| `BUCKET_ACCESS_DENIED` | 403    | Friend does not have access to this privacy bucket                    |
| `QUOTA_EXCEEDED`       | 413    | Storage quota exceeded                                                |
| `PRECONDITION_FAILED`  | 412    | ETag mismatch or other precondition                                   |
| `INVALID_CURSOR`       | 400    | Pagination cursor malformed or expired                                |
| `CYCLE_DETECTED`       | 409    | Hierarchical operation would create a cycle                           |
| `MAX_DEPTH_EXCEEDED`   | 409    | Hierarchy depth limit exceeded                                        |

### 4.4 Idempotency

**Mutating endpoints** (POST for creation) support idempotency via the `Idempotency-Key` header. The key is scoped per-account.

```
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

**Behavior:**

- Key max length: 64 characters. UUIDs recommended.
- If a request with the same key was already completed, the cached response is replayed (same status code and body).
- If a request with the same key is currently in flight, the server returns `409 IDEMPOTENCY_CONFLICT`.
- Server errors (5xx) are **not cached** -- they can be retried with the same key.
- Cached responses have a TTL of **24 hours**.

**Which endpoints support it:** All `POST` creation endpoints apply the idempotency middleware (e.g., member creation, fronting session creation, blob upload URL, timer config creation, webhook config creation, and similar). Non-creation mutations (PATCH, DELETE, archive/restore) are naturally idempotent and do not use the header.

### 4.5 ETag and Conditional Requests

Export and manifest endpoints return an `ETag` header (weak validator):

```
ETag: W/"a1b2c3d4e5f67890"
```

The ETag is computed from `MAX(updatedAt)` and entity count -- it changes when entities are added, removed, or modified.

**Conditional request flow:**

1. Client stores the `ETag` from a previous response.
2. Client sends the next request with `If-None-Match: W/"a1b2c3d4e5f67890"`.
3. If the data has not changed, the server returns `304 Not Modified` with no body.
4. If the data has changed, the server returns the full response with a new `ETag`.

This is used primarily on bucket export and friend export endpoints to avoid re-transferring unchanged data.

### 4.6 Rate Limiting

Rate limits use a **fixed-window** algorithm keyed by client IP (when behind a reverse proxy with `TRUST_PROXY=1`). Every response includes rate limit headers:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1711843260
```

When the limit is exceeded, the server returns `429` with an additional `Retry-After` header (seconds until the window resets).

**Rate limit categories:**

| Category               | Limit | Window | Applied To                                    |
| ---------------------- | ----- | ------ | --------------------------------------------- |
| `global`               | 100   | 1 min  | All requests (outer layer)                    |
| `authHeavy`            | 5     | 1 min  | Register, login, password reset               |
| `authLight`            | 20    | 1 min  | Sessions, biometric, recovery key             |
| `deviceTransfer`       | 10    | 1 min  | Device transfer endpoints                     |
| `write`                | 60    | 1 min  | Create, update, delete, archive, restore      |
| `readDefault`          | 60    | 1 min  | Standard reads and lists                      |
| `readHeavy`            | 30    | 1 min  | Expensive reads (export manifests, analytics) |
| `blobUpload`           | 20    | 1 min  | Upload URL generation                         |
| `webhookManagement`    | 20    | 1 min  | Webhook config CRUD                           |
| `dataExport`           | 2     | 1 hour | Full data export                              |
| `dataImport`           | 2     | 1 hour | Full data import                              |
| `accountPurge`         | 1     | 1 day  | Account purge                                 |
| `auditQuery`           | 30    | 1 min  | Audit log queries                             |
| `friendCodeGeneration` | 10    | 1 min  | Friend code creation                          |
| `friendCodeRedeem`     | 5     | 1 min  | Friend code redemption                        |
| `publicApi`            | 60    | 1 min  | Public-facing API key endpoints               |
| `sseStream`            | 5     | 1 min  | SSE notification streams                      |

Exact values are defined in `@pluralscape/types` (`RATE_LIMITS`). See `docs/planning/api-specification.md` for the full specification.

**Client retry guidance:** exponential backoff starting at 1 second, multiplier 2, max 60 seconds, max 3 attempts. Defined in `CLIENT_RETRY` in `@pluralscape/types`.

---

## 5. CRUD Patterns

### 5.1 Standard Entity Lifecycle

Most entities follow a consistent lifecycle:

```
create --> read --> list --> update --> archive --> restore --> delete
```

Not all entities support every operation. Archival is always permitted. Permanent deletion may be blocked if the entity has dependents.

### 5.2 URL Patterns

All entity routes are scoped under a system:

```
POST   /v1/systems/:systemId/{resource}                Create
GET    /v1/systems/:systemId/{resource}                 List (paginated)
GET    /v1/systems/:systemId/{resource}/:id             Get single
PATCH  /v1/systems/:systemId/{resource}/:id             Update
POST   /v1/systems/:systemId/{resource}/:id/archive     Archive
POST   /v1/systems/:systemId/{resource}/:id/restore     Restore
DELETE /v1/systems/:systemId/{resource}/:id             Delete
```

**Status codes:**

| Operation | Success Status   | Body                                               |
| --------- | ---------------- | -------------------------------------------------- |
| Create    | `201 Created`    | `{ data: { ... } }`                                |
| Get       | `200 OK`         | `{ data: { ... } }`                                |
| List      | `200 OK`         | `{ data: [...], nextCursor, hasMore, totalCount }` |
| Update    | `200 OK`         | `{ data: { ... } }`                                |
| Archive   | `204 No Content` | _(empty)_                                          |
| Restore   | `204 No Content` | _(empty)_                                          |
| Delete    | `204 No Content` | _(empty)_                                          |

**Available resources** (non-exhaustive):

`members`, `groups`, `custom-fronts`, `fronting-sessions`, `buckets`, `fields`, `relationships`, `lifecycle-events`, `innerworld/*`, `blobs`, `timer-configs`, `webhook-configs`, `channels`, `board-messages`, `notes`, `polls`, `structure/*`, `api-keys`, `notification-configs`

Some resources have nested sub-routes (e.g., `members/:memberId/photos`, `members/:memberId/fields`, `channels/:channelId/messages`, `fronting-sessions/:sessionId/comments`).

### 5.3 Deletion Semantics

Pluralscape uses a **fail-closed deletion** model:

1. **Archive** is always allowed. Archived entities are hidden from default list queries but remain in the database. Archive and restore are idempotent (archiving an already-archived entity returns `409 ALREADY_ARCHIVED`; restoring a non-archived entity returns `409 NOT_ARCHIVED`).

2. **Permanent deletion** checks for dependents. If the entity has dependent records (e.g., a member referenced by fronting sessions), the server returns:

   ```
   409 Conflict
   ```

   ```json
   {
     "error": {
       "code": "HAS_DEPENDENTS",
       "message": "Cannot delete: entity has dependent records"
     },
     "requestId": "..."
   }
   ```

   The client must remove or reassign dependents before retrying the delete.

3. **Database enforcement:** entity foreign keys use `onDelete: "restrict"`. This means the database itself prevents orphaned references. The `HAS_DEPENDENTS` check in the service layer provides a user-friendly error before hitting the database constraint.

4. **Account/system purge** is the exception: `system_id` and `account_id` foreign keys use `ON DELETE CASCADE`, allowing a single purge operation to remove all data. This is rate-limited to 1 per day (`accountPurge` category).

### 5.4 Blob Upload Pipeline

Blob uploads use a **presigned URL** flow to keep binary data off the API server:

```
1. Request upload URL     POST /v1/systems/:systemId/blobs/upload-url
2. Upload to storage      PUT  <presignedUrl>  (direct to S3/MinIO)
3. Confirm upload         POST /v1/systems/:systemId/blobs/:blobId/confirm
4. Download later         GET  /v1/systems/:systemId/blobs/:blobId/download-url
```

**Step 1 -- Request upload URL:**

```json
POST /v1/systems/:systemId/blobs/upload-url
{
  "purpose": "avatar",
  "mimeType": "image/png",
  "sizeBytes": 204800,
  "encryptionTier": 1
}
```

Response (`201 Created`):

```json
{
  "data": {
    "blobId": "blob_...",
    "uploadUrl": "https://storage.example.com/...",
    "expiresAt": 1711843260000
  }
}
```

**Step 2 -- Upload to storage:** `PUT` the raw bytes to `uploadUrl` before `expiresAt`.

**Step 3 -- Confirm upload:**

```json
POST /v1/systems/:systemId/blobs/:blobId/confirm
{
  "checksum": "sha256hex...",
  "thumbnailOfBlobId": null
}
```

Confirmation is idempotent -- confirming an already-confirmed blob returns the blob metadata without error.

**Step 4 -- Download:** `GET /v1/systems/:systemId/blobs/:blobId/download-url` returns a time-limited presigned download URL.

**Per-purpose size limits:**

| Purpose             | Max Size |
| ------------------- | -------- |
| `avatar`            | 5 MiB    |
| `member-photo`      | 10 MiB   |
| `journal-image`     | 10 MiB   |
| `attachment`        | 25 MiB   |
| `export`            | 500 MiB  |
| `littles-safe-mode` | 5 MiB    |

Exceeding the limit returns `413 BLOB_TOO_LARGE`. Storage quota violations return `413 QUOTA_EXCEEDED`.

### 5.5 Polymorphic Subjects in Fronting

Fronting sessions and fronting comments support **polymorphic subjects** -- the entity being tracked can be a member, a custom front, or a structure entity. The database enforces that at least one must be present:

```json
{
  "memberId": "mem_...",
  "customFrontId": null,
  "structureEntityId": null
}
```

Or for a custom front:

```json
{
  "memberId": null,
  "customFrontId": "cf_...",
  "structureEntityId": null
}
```

Or for a structure entity:

```json
{
  "memberId": null,
  "customFrontId": null,
  "structureEntityId": "se_..."
}
```

Exactly one of `memberId`, `customFrontId`, or `structureEntityId` should be non-null (the database constraint requires at least one, but the application enforces exactly one). These foreign keys use `ON DELETE RESTRICT` -- you cannot delete a member, custom front, or structure entity that is referenced by an active fronting session. Archive the session first, or end and delete it.

This pattern enables tracking fronting for abstract cognitive states (custom fronts like "Dissociated" or "Blurry") and system-defined structure entities alongside traditional member-based fronting.

---

## 6. Sync Protocol

Pluralscape uses an encrypted CRDT sync protocol for offline-first data synchronization. The server is an encrypted relay -- it stores and forwards ciphertext without ever seeing plaintext content. All encryption and decryption happen on the client.

The protocol is transport-agnostic. The primary transport is WebSocket; HTTP long-polling is a fallback. The wire format is JSON with binary fields (ciphertext, nonces, signatures, public keys) encoded as Base64url strings.

### 6.1 WebSocket Connection

**Endpoint:**

```
wss://{host}/v1/sync/ws
```

**Subprotocol:** `pluralscape-sync-v1` (declared during the WebSocket upgrade handshake).

**Authentication:** the client authenticates after the WebSocket connection is established by sending an `AuthenticateRequest` message containing the session token (the same `ps_sess_...` token used for REST). The token is sent inside the message payload, not as a query parameter or header. The server closes the connection if no `AuthenticateRequest` arrives within 10 seconds.

**Connection limits:**

| Constraint                               | Value      |
| ---------------------------------------- | ---------- |
| Max connections per account              | 10         |
| Max unauthenticated connections (global) | 500        |
| Max unauthenticated connections per IP   | 50         |
| Max message size                         | 5 MB       |
| Auth timeout                             | 10 seconds |
| Idle timeout                             | 60 seconds |

**Heartbeat:** the server sends application-level Ping messages every 30 seconds. If no Pong is received within 10 seconds, the connection is closed. This detects silent disconnects that TCP keepalive might miss.

### 6.2 Session Lifecycle

The sync session follows a strict handshake sequence:

```
Client                                Server
  |                                     |
  |-- AuthenticateRequest ------------->|  session token + systemId + profileType
  |<-- AuthenticateResponse ------------|  syncSessionId + serverTime
  |                                     |
  |-- ManifestRequest ----------------->|  request filtered document list
  |<-- ManifestResponse ----------------|  manifest of all sync documents
  |                                     |
  |-- SubscribeRequest ---------------->|  local sync positions per document
  |<-- SubscribeResponse ---------------|  catch-up changes + snapshots
  |                                     |
  |         --- steady state ---        |
  |<-- DocumentUpdate ------------------|  server pushes new changes
  |-- SubmitChangeRequest ------------->|  client submits encrypted change
  |<-- ChangeAccepted ------------------|  server confirms with assigned seq
  |<-- ManifestChanged -----------------|  manifest updated (new doc, grant)
```

**Ordering requirements:**

1. `AuthenticateRequest` must be the first message. Anything else before authentication produces `SyncError { code: "AUTH_FAILED" }` and a connection close.
2. `ManifestRequest` must precede `SubscribeRequest`.
3. After the handshake, messages flow concurrently -- there is no strict turn-taking.

**Protocol version:** `AuthenticateRequest` declares `protocolVersion: 1`. If the server does not support the client's version, it responds with `SyncError { code: "PROTOCOL_MISMATCH" }` and closes.

### 6.3 Message Types

Every message shares a common base:

```json
{
  "type": "AuthenticateRequest",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

`correlationId` is a client-generated UUID that the server echoes on direct responses. Server-pushed messages (`DocumentUpdate`, `ManifestChanged`) set `correlationId` to `null`.

**Client -> Server (9 message types):**

| Type                    | Description                                                   |
| ----------------------- | ------------------------------------------------------------- |
| `AuthenticateRequest`   | Present session token, systemId, and replication profile type |
| `ManifestRequest`       | Request the filtered sync manifest                            |
| `SubscribeRequest`      | Subscribe to documents with local sync positions              |
| `UnsubscribeRequest`    | Cancel real-time subscription for a document                  |
| `FetchSnapshotRequest`  | Request the latest encrypted snapshot                         |
| `FetchChangesRequest`   | Request changes since a given seq                             |
| `SubmitChangeRequest`   | Submit a new encrypted change envelope                        |
| `SubmitSnapshotRequest` | Submit a new encrypted snapshot (compaction)                  |
| `DocumentLoadRequest`   | Load a non-subscribed document on demand                      |

**Server -> Client (10 message types):**

| Type                   | Description                                                           |
| ---------------------- | --------------------------------------------------------------------- |
| `AuthenticateResponse` | Session established; returns syncSessionId and serverTime             |
| `ManifestResponse`     | Returns the filtered manifest                                         |
| `SubscribeResponse`    | Confirms subscriptions with per-document catch-up data                |
| `DocumentUpdate`       | Real-time push of new changes (server-initiated, correlationId: null) |
| `SnapshotResponse`     | Returns requested snapshot                                            |
| `ChangesResponse`      | Returns requested changes                                             |
| `ChangeAccepted`       | Confirms change acceptance with server-assigned seq                   |
| `SnapshotAccepted`     | Confirms snapshot acceptance                                          |
| `ManifestChanged`      | Push notification that the manifest changed (server-initiated)        |
| `SyncError`            | Error response for any failed request                                 |

### 6.4 Replication Profiles

The `AuthenticateRequest` declares a `profileType` that determines which documents the client receives:

| Profile      | Receives                                    | Use Case                                       |
| ------------ | ------------------------------------------- | ---------------------------------------------- |
| `owner-full` | All documents (active + archived)           | Primary devices with no storage constraints    |
| `owner-lite` | Current-period documents + active channels  | Low-storage devices (wearables, budget phones) |
| `friend`     | Only bucket documents with active KeyGrants | Friends viewing shared content                 |

**Owner-lite filtering:** system-core, privacy-config, and bucket documents are always included. Fronting documents include only the current time period. Chat channels are included only if updated within the active channel window (default: 30 days). Journal and note documents are excluded (available on demand). Historical documents for all types are available via `DocumentLoadRequest`.

**Friend filtering:** the server filters the manifest before delivery, returning only bucket documents for which the friend has a non-revoked KeyGrant. Friends cannot access system-core, chat, journal, or other document types.

### 6.5 Document Model

The sync layer uses **Automerge CRDT** documents. Each document is identified by a string ID following a naming convention:

| Document Type    | ID Format                       | Time-Split | Encryption Key          |
| ---------------- | ------------------------------- | ---------- | ----------------------- |
| `system-core`    | `system-core-{systemId}`        | None       | Derived from master key |
| `fronting`       | `fronting-{systemId}[-YYYY-QN]` | Quarter    | Derived from master key |
| `chat`           | `chat-{channelId}[-YYYY-MM]`    | Month      | Derived from master key |
| `journal`        | `journal-{systemId}[-YYYY]`     | Year       | Derived from master key |
| `note`           | `note-{systemId}[-YYYY]`        | Year       | Derived from master key |
| `privacy-config` | `privacy-config-{systemId}`     | None       | Derived from master key |
| `bucket`         | `bucket-{bucketId}`             | None       | Bucket key              |

**Time-splitting:** documents that grow over time (fronting, chat, journal, note) are split into time-bounded segments when they exceed a size threshold. The split thresholds are: fronting 5 MiB, chat 5 MiB, journal 10 MiB, note 10 MiB.

**Encrypted relay model:** the server never sees plaintext Automerge data. The client:

1. Makes a local Automerge change.
2. Extracts the binary change bytes.
3. Encrypts them with the document's encryption key (XChaCha20-Poly1305).
4. Signs the encrypted envelope with the Ed25519 signing key.
5. Sends the `EncryptedChangeEnvelope` to the server.

The server validates the signature, assigns a monotonically increasing `seq` number, stores the ciphertext, and relays to other subscribed clients. It never decrypts the content.

**Encrypted change envelope:**

```json
{
  "ciphertext": "<base64url>",
  "nonce": "<base64url, 24 bytes>",
  "signature": "<base64url, 64 bytes>",
  "authorPublicKey": "<base64url, 32 bytes>",
  "documentId": "system-core-sys_abc",
  "seq": 42
}
```

**Encrypted snapshot envelope** (for compaction):

```json
{
  "ciphertext": "<base64url>",
  "nonce": "<base64url>",
  "signature": "<base64url>",
  "authorPublicKey": "<base64url>",
  "documentId": "system-core-sys_abc",
  "snapshotVersion": 5
}
```

### 6.6 Sync Manifest

The manifest is a plaintext listing of all sync documents for a system. It contains only metadata -- no encrypted content:

```json
{
  "systemId": "sys_abc",
  "documents": [
    {
      "docId": "system-core-sys_abc",
      "docType": "system-core",
      "keyType": "derived",
      "bucketId": null,
      "channelId": null,
      "timePeriod": null,
      "createdAt": 1711843260000,
      "updatedAt": 1711843260000,
      "sizeBytes": 102400,
      "snapshotVersion": 3,
      "lastSeq": 42,
      "archived": false
    }
  ]
}
```

The client uses the manifest to determine which documents to subscribe to (via the replication profile filter), which documents are available for on-demand loading, and which local documents should be evicted (no longer in the manifest).

When the server pushes a `ManifestChanged` message, the client must re-fetch the full manifest to get accurate state. The `hint` field on `ManifestChanged` is informational only.

### 6.7 Subscription and Catch-Up

After receiving the manifest, the client sends a `SubscribeRequest` declaring its local sync positions:

```json
{
  "type": "SubscribeRequest",
  "correlationId": "...",
  "documents": [
    {
      "docId": "system-core-sys_abc",
      "lastSyncedSeq": 38,
      "lastSnapshotVersion": 2
    }
  ]
}
```

The server computes catch-up data per document and responds with:

```json
{
  "type": "SubscribeResponse",
  "correlationId": "...",
  "catchup": [
    {
      "docId": "system-core-sys_abc",
      "changes": [
        /* envelopes with seq 39..42 */
      ],
      "snapshot": null
    }
  ],
  "droppedDocIds": []
}
```

- `catchup` is omitted for documents where the client is already current.
- `snapshot` is present only when the server holds a newer snapshot than the client's `lastSnapshotVersion`. The client should bootstrap from the snapshot, then apply the provided changes.
- `droppedDocIds` lists document IDs dropped because the subscription cap (100 per request, 500 per connection) was reached. Dropped documents must be loaded on demand.

**On-demand loading:** for documents not in the active subscription set (historical periods, lite-profile journals), the client sends `DocumentLoadRequest`. The server responds with `SnapshotResponse` + `ChangesResponse` for that document, subject to the same access checks as subscription.

### 6.8 Steady-State Sync

After the handshake, the change submission cycle is:

1. Client creates a local Automerge change, encrypts it, sends `SubmitChangeRequest`.
2. Server validates the envelope signature, assigns `seq`, stores the ciphertext.
3. Server sends `ChangeAccepted { assignedSeq }` to the submitting client.
4. Server broadcasts `DocumentUpdate` with the new envelope to all other subscribed clients.

**Change deduplication:** the server deduplicates by `(docId, authorPublicKey, nonce)`. Submitting the same change twice is safe and idempotent.

**Compaction:** when a document accumulates too many changes (default threshold: 200 changes or 1 MiB size increase), the client compacts by saving the full Automerge state as an encrypted snapshot and submitting it via `SubmitSnapshotRequest`. The server accepts only if `snapshotVersion` strictly exceeds the current value. Concurrent compaction from two devices: the higher version wins; the lower gets `VERSION_CONFLICT`.

**Rate limiting on WebSocket:**

| Category                                 | Limit | Window     |
| ---------------------------------------- | ----- | ---------- |
| Mutations (SubmitChange, SubmitSnapshot) | 100   | 10 seconds |
| Reads (Fetch*, Manifest*)                | 200   | 10 seconds |

After 10 consecutive rate limit strikes, the server closes the connection.

### 6.9 Offline Queue

When the client is disconnected, local changes are queued in an offline queue (SQLite-backed on mobile). On reconnect:

1. The client re-authenticates, re-fetches the manifest, re-subscribes with current local seq positions.
2. The offline queue is drained in batches (up to 500 entries per batch).
3. Entries are grouped by document and replayed serially within each document to preserve causal ordering.
4. Up to 3 documents are replayed concurrently.
5. Each entry is retried up to 3 times with exponential backoff (500 ms base, 0.5-1.0x jitter).
6. Non-retriable errors (4xx except 408/429) fail the entry immediately.
7. If an entry fails, all causally-dependent entries for that document are skipped.
8. Server-side nonce deduplication makes re-submission safe after crashes.

The client should not clear the local queue until the server confirms acceptance (`ChangeAccepted`).

### 6.10 Conflict Resolution

Automerge handles structural merge automatically (concurrent edits to different fields merge cleanly). However, application-level invariants may be violated after a CRDT merge. The sync engine runs **post-merge validation** to detect and correct these:

**Hierarchy cycle detection:** if concurrent edits to `parentGroupId` fields create a cycle in the group hierarchy, the validator breaks the cycle by setting one entity's parent to `null` (root). The correction is emitted as a new CRDT change and synced to all devices.

**Sort order repair:** if concurrent edits produce duplicate or non-contiguous sort orders within a collection, the validator renormalizes sort orders to restore a consistent sequence.

**Fronting session normalization:** concurrent edits that produce invalid fronting states (e.g., `endTime < startTime`) are corrected automatically.

**Timer config normalization:** waking-hours constraints are validated and corrected if concurrent edits produce impossible time ranges.

**Conflict notifications:** all auto-resolved conflicts generate ephemeral `ConflictNotification` records. These are not persisted to the CRDT document -- they are delivered to the client callback for UI display.

**Correction envelopes:** all corrections are submitted as new encrypted changes, so they become part of the document's CRDT history and propagate to all devices.

### 6.11 Error Codes

| Code                   | Recovery                                          |
| ---------------------- | ------------------------------------------------- |
| `AUTH_FAILED`          | Re-authenticate; refresh session token            |
| `AUTH_EXPIRED`         | Refresh session token, then reconnect             |
| `PERMISSION_DENIED`    | Do not retry; check access permissions            |
| `DOCUMENT_NOT_FOUND`   | Re-fetch manifest; document may have been removed |
| `DOCUMENT_LOAD_DENIED` | Do not retry; verify KeyGrant status              |
| `SNAPSHOT_NOT_FOUND`   | Fall back to full change replay                   |
| `VERSION_CONFLICT`     | Re-fetch latest snapshot; discard local snapshot  |
| `MALFORMED_MESSAGE`    | Fix message construction; do not retry unchanged  |
| `QUOTA_EXCEEDED`       | Surface to user; evict archived documents         |
| `RATE_LIMITED`         | Exponential backoff starting at 1 second          |
| `INVALID_ENVELOPE`     | Check signing key and envelope construction       |
| `PROTOCOL_MISMATCH`    | Upgrade client; do not retry                      |
| `INTERNAL_ERROR`       | Exponential backoff starting at 5 seconds         |

### 6.12 SSE Notification Stream

A separate Server-Sent Events (SSE) stream delivers real-time notifications outside the sync protocol (e.g., webhook delivery results, account-level events).

**Endpoint:**

```
GET /v1/notifications/stream
```

**Authentication:** standard session auth via `Authorization: Bearer ps_sess_...` header.

**Connection limits:**

| Constraint                                 | Value                                           |
| ------------------------------------------ | ----------------------------------------------- |
| Max concurrent SSE connections per account | 5                                               |
| Rate limit                                 | 5 connections per minute (`sseStream` category) |

**Heartbeat:** the server sends a `: heartbeat` comment every 30 seconds to prevent proxy timeouts. An immediate heartbeat is sent on connection to flush response headers. The Bun HTTP idle timeout is 60 seconds.

**Reconnect replay:** include the `Last-Event-ID` header when reconnecting. The server replays missed events from a ring buffer (100 events, 5-minute max age). If the requested event ID is outside the replay window, the server sends a `full-sync` event:

```
event: full-sync
data: {"reason":"replay-window-exceeded"}
id: 42
```

**Event delivery:** events arrive via Valkey pub/sub on channel `ps:notify:{accountId}`. Each event has an `event` type, JSON `data`, and a monotonically increasing `id`:

```
event: notification
data: {"type":"fronting.started","sessionId":"fs_abc"}
id: 15
```

Multiple browser tabs or devices sharing the same account share a single Valkey subscription on the server. Events are fanned out to all connected SSE streams for that account.

---

## 7. Webhooks

Webhooks deliver event notifications to external HTTP endpoints. The server dispatches events by creating pending delivery records that a background worker processes with retry logic.

### 7.1 Webhook Config CRUD

Webhook configs are scoped to a system and follow the standard entity lifecycle:

```
POST   /v1/systems/:systemId/webhook-configs                Create
GET    /v1/systems/:systemId/webhook-configs                 List (paginated)
GET    /v1/systems/:systemId/webhook-configs/:webhookId      Get single
PUT    /v1/systems/:systemId/webhook-configs/:webhookId      Update
POST   /v1/systems/:systemId/webhook-configs/:webhookId/archive     Archive
POST   /v1/systems/:systemId/webhook-configs/:webhookId/restore     Restore
DELETE /v1/systems/:systemId/webhook-configs/:webhookId      Delete
```

**Rate limit:** `webhookManagement` category (20 per minute) for list/get/update/delete/archive/restore; `write` category (60 per minute) for create. Creation uses idempotency middleware.

**Quota:** maximum 25 active (non-archived) webhook configs per system.

**Create request body:**

```json
{
  "url": "https://example.com/webhook",
  "eventTypes": ["member.created", "fronting.started"],
  "enabled": true,
  "cryptoKeyId": null
}
```

- `url`: must use HTTPS (localhost/127.0.0.1/::1 exempt for development). The server resolves the hostname and validates against SSRF (private/reserved IP ranges are blocked).
- `eventTypes`: array of event types to subscribe to (see section 7.6).
- `enabled`: whether the webhook receives deliveries.
- `cryptoKeyId`: optional API key ID for payload encryption. When set, delivery payloads are encrypted at rest in the database.

**Create response (201 Created):**

```json
{
  "data": {
    "id": "wh_...",
    "systemId": "sys_...",
    "url": "https://example.com/webhook",
    "eventTypes": ["member.created", "fronting.started"],
    "enabled": true,
    "cryptoKeyId": null,
    "version": 1,
    "archived": false,
    "archivedAt": null,
    "createdAt": 1711843260000,
    "updatedAt": 1711843260000,
    "secret": "base64-encoded-secret"
  }
}
```

The `secret` field is returned only on creation and secret rotation. It is a 32-byte random value, base64-encoded. The `Cache-Control: no-store` header is set on responses that include the secret.

**Update** uses optimistic concurrency control via a `version` field. Include the current `version` in the update body; the server rejects with `412 PRECONDITION_FAILED` if it does not match.

**Delete** is blocked if the webhook has pending deliveries (`409 HAS_DEPENDENTS`). Wait for deliveries to complete or archive the webhook instead.

### 7.2 Secret Generation

When a webhook config is created, the server generates a 32-byte (256-bit) cryptographically random secret using `node:crypto.randomBytes()`. The raw bytes are stored in the database; the base64 encoding is returned to the client exactly once in the creation response.

The secret is used for HMAC-SHA256 signature computation on all outgoing deliveries. The client must store it securely -- the server will not return it again.

### 7.3 HMAC Signature Verification

Every webhook delivery includes two headers:

| Header                    | Value                                          |
| ------------------------- | ---------------------------------------------- |
| `X-Pluralscape-Signature` | Hex-encoded HMAC-SHA256 signature              |
| `X-Pluralscape-Timestamp` | Unix epoch seconds when the payload was signed |

The signature is computed over the string `{timestamp}.{payload}` where `timestamp` is the `X-Pluralscape-Timestamp` value and `payload` is the raw JSON request body.

**Verification steps:**

1. Extract the `X-Pluralscape-Signature` and `X-Pluralscape-Timestamp` headers.
2. Reconstruct the signed content: `"${timestamp}.${body}"`.
3. Compute HMAC-SHA256 of the signed content using the webhook secret (base64-decode the secret to raw bytes first).
4. Compare the computed hex digest to the signature header using a **constant-time comparison**.
5. **Replay protection:** reject if the timestamp is more than 5 minutes from the current time.

For complete code examples in Node.js, Python, and Go, see [`docs/guides/webhook-signature-verification.md`](webhook-signature-verification.md).

### 7.4 Secret Rotation

```
POST /v1/systems/:systemId/webhook-configs/:webhookId/rotate-secret
```

**Request body:**

```json
{
  "version": 2
}
```

The `version` field is required for optimistic concurrency (same as update).

**Response:** same shape as creation, including the new `secret` field and an incremented `version`.

**Grace period:** during rotation, deliveries already in flight may be signed with the old secret. Consumers should implement dual-secret verification:

1. Attempt verification with the **new** secret first.
2. If that fails, retry with the **old** secret.
3. Accept if either succeeds.
4. Discard the old secret once all in-flight deliveries have been processed (typically within a few minutes).

### 7.5 Test / Ping

```
POST /v1/systems/:systemId/webhook-configs/:webhookId/test
```

Sends a synthetic test delivery to the webhook endpoint **inline** (not queued through the delivery worker). The test payload has event type `webhook.test`:

```json
{
  "event": "webhook.test",
  "webhookId": "wh_...",
  "systemId": "sys_...",
  "timestamp": 1711843260000
}
```

**Response:**

```json
{
  "data": {
    "success": true,
    "httpStatus": 200,
    "error": null,
    "durationMs": 142
  }
}
```

The test delivery goes through the same SSRF validation and HMAC signing as real deliveries. It does not create a delivery record in the database.

### 7.6 Event Types

Webhook payloads contain T3 (plaintext) metadata only -- entity IDs, timestamps, and structural data. The server never includes encrypted content in webhook payloads. The `systemId` is automatically injected into every payload by the dispatcher.

**Identity events:**

| Event Type                 | Payload             | Fires When               |
| -------------------------- | ------------------- | ------------------------ |
| `member.created`           | `{ memberId }`      | New member created       |
| `member.updated`           | `{ memberId }`      | Member fields updated    |
| `member.archived`          | `{ memberId }`      | Member archived          |
| `fronting.started`         | `{ sessionId }`     | Fronting session started |
| `fronting.ended`           | `{ sessionId }`     | Fronting session ended   |
| `group.created`            | `{ groupId }`       | New group created        |
| `group.updated`            | `{ groupId }`       | Group fields updated     |
| `lifecycle.event-recorded` | `{ eventId }`       | Lifecycle event recorded |
| `custom-front.changed`     | `{ customFrontId }` | Custom front updated     |

**Communication -- channels:**

| Event Type         | Payload         | Fires When       |
| ------------------ | --------------- | ---------------- |
| `channel.created`  | `{ channelId }` | Channel created  |
| `channel.updated`  | `{ channelId }` | Channel updated  |
| `channel.archived` | `{ channelId }` | Channel archived |
| `channel.restored` | `{ channelId }` | Channel restored |
| `channel.deleted`  | `{ channelId }` | Channel deleted  |

**Communication -- messages:**

| Event Type         | Payload                    | Fires When       |
| ------------------ | -------------------------- | ---------------- |
| `message.created`  | `{ messageId, channelId }` | Message created  |
| `message.updated`  | `{ messageId, channelId }` | Message updated  |
| `message.archived` | `{ messageId, channelId }` | Message archived |
| `message.restored` | `{ messageId, channelId }` | Message restored |
| `message.deleted`  | `{ messageId, channelId }` | Message deleted  |

**Communication -- board messages:**

| Event Type                | Payload              | Fires When              |
| ------------------------- | -------------------- | ----------------------- |
| `board-message.created`   | `{ boardMessageId }` | Board message created   |
| `board-message.updated`   | `{ boardMessageId }` | Board message updated   |
| `board-message.pinned`    | `{ boardMessageId }` | Board message pinned    |
| `board-message.unpinned`  | `{ boardMessageId }` | Board message unpinned  |
| `board-message.reordered` | `{ boardMessageId }` | Board message reordered |
| `board-message.archived`  | `{ boardMessageId }` | Board message archived  |
| `board-message.restored`  | `{ boardMessageId }` | Board message restored  |
| `board-message.deleted`   | `{ boardMessageId }` | Board message deleted   |

**Communication -- notes:**

| Event Type      | Payload      | Fires When    |
| --------------- | ------------ | ------------- |
| `note.created`  | `{ noteId }` | Note created  |
| `note.updated`  | `{ noteId }` | Note updated  |
| `note.archived` | `{ noteId }` | Note archived |
| `note.restored` | `{ noteId }` | Note restored |
| `note.deleted`  | `{ noteId }` | Note deleted  |

**Communication -- polls:**

| Event Type      | Payload      | Fires When    |
| --------------- | ------------ | ------------- |
| `poll.created`  | `{ pollId }` | Poll created  |
| `poll.updated`  | `{ pollId }` | Poll updated  |
| `poll.closed`   | `{ pollId }` | Poll closed   |
| `poll.archived` | `{ pollId }` | Poll archived |
| `poll.restored` | `{ pollId }` | Poll restored |
| `poll.deleted`  | `{ pollId }` | Poll deleted  |

**Communication -- poll votes:**

| Event Type           | Payload              | Fires When          |
| -------------------- | -------------------- | ------------------- |
| `poll-vote.cast`     | `{ pollId, voteId }` | Vote cast on a poll |
| `poll-vote.vetoed`   | `{ pollId, voteId }` | Vote vetoed         |
| `poll-vote.updated`  | `{ pollId, voteId }` | Vote updated        |
| `poll-vote.archived` | `{ pollId, voteId }` | Vote archived       |

**Communication -- acknowledgements:**

| Event Type                  | Payload                 | Fires When                |
| --------------------------- | ----------------------- | ------------------------- |
| `acknowledgement.created`   | `{ acknowledgementId }` | Acknowledgement created   |
| `acknowledgement.confirmed` | `{ acknowledgementId }` | Acknowledgement confirmed |
| `acknowledgement.archived`  | `{ acknowledgementId }` | Acknowledgement archived  |
| `acknowledgement.restored`  | `{ acknowledgementId }` | Acknowledgement restored  |
| `acknowledgement.deleted`   | `{ acknowledgementId }` | Acknowledgement deleted   |

**Privacy -- buckets:**

| Event Type                    | Payload                              | Fires When                  |
| ----------------------------- | ------------------------------------ | --------------------------- |
| `bucket.created`              | `{ bucketId }`                       | Bucket created              |
| `bucket.updated`              | `{ bucketId }`                       | Bucket updated              |
| `bucket.archived`             | `{ bucketId }`                       | Bucket archived             |
| `bucket.restored`             | `{ bucketId }`                       | Bucket restored             |
| `bucket.deleted`              | `{ bucketId }`                       | Bucket deleted              |
| `bucket-content-tag.tagged`   | `{ bucketId, entityType, entityId }` | Entity tagged into bucket   |
| `bucket-content-tag.untagged` | `{ bucketId, entityType, entityId }` | Entity untagged from bucket |

**Privacy -- field bucket visibility:**

| Event Type                        | Payload                           | Fires When                           |
| --------------------------------- | --------------------------------- | ------------------------------------ |
| `field-bucket-visibility.set`     | `{ fieldDefinitionId, bucketId }` | Field made visible in bucket         |
| `field-bucket-visibility.removed` | `{ fieldDefinitionId, bucketId }` | Field visibility removed from bucket |

**Privacy -- friends:**

| Event Type                 | Payload                             | Fires When                    |
| -------------------------- | ----------------------------------- | ----------------------------- |
| `friend.connected`         | `{ connectionId, friendAccountId }` | Friend connection established |
| `friend.removed`           | `{ connectionId, friendAccountId }` | Friend removed                |
| `friend.bucket-assigned`   | `{ connectionId, bucketId }`        | Bucket assigned to friend     |
| `friend.bucket-unassigned` | `{ connectionId, bucketId }`        | Bucket unassigned from friend |

### 7.7 Delivery Mechanics

**Dispatch:** when a service operation triggers an event, the dispatcher queries enabled webhook configs that subscribe to that event type and creates a pending delivery record per matching config. Delivery records are created atomically within the service transaction.

**Delivery worker:** a background worker picks up pending deliveries, resolves the webhook URL (with SSRF validation), computes the HMAC signature, and sends the HTTP request. The worker enforces per-hostname concurrency (max 5 concurrent deliveries per host) with a 30-second throttle delay between batches to the same host.

**Retry policy:**

| Parameter            | Value                                    |
| -------------------- | ---------------------------------------- |
| Max retry attempts   | 5                                        |
| Backoff strategy     | Exponential (2^attempt \* 1 second base) |
| Jitter               | 25%                                      |
| Delivery timeout     | 10 seconds                               |
| Success status range | 200-299                                  |

**Delivery retention:** delivery records are retained for 30 days, then cleaned up in batches.

**Optional payload encryption:** when `cryptoKeyId` is set on the webhook config, delivery payloads are encrypted at rest in the database using the referenced API key. The worker decrypts the payload before sending. This protects payload data if the database is compromised.

---

## 8. Domain-Specific Patterns

This section covers endpoint patterns, key concepts, and gotchas for each major domain. All routes below are nested under `/v1/systems/:systemId/` unless otherwise noted.

### 8.1 Fronting

Fronting tracks which members, custom fronts, or structure entities currently have executive control. Sessions use overlapping time ranges -- co-fronting is the norm, not an exception.

**Key endpoints:**

| Method   | Path                                | Purpose                                            |
| -------- | ----------------------------------- | -------------------------------------------------- |
| `POST`   | `/fronting-sessions`                | Start a new fronting session                       |
| `POST`   | `/fronting-sessions/:sessionId/end` | End a session (sets `endedAt`)                     |
| `GET`    | `/fronting-sessions`                | List sessions (supports filtering by active/ended) |
| `GET`    | `/fronting-sessions/:sessionId`     | Get a single session                               |
| `PATCH`  | `/fronting-sessions/:sessionId`     | Update session metadata                            |
| `DELETE` | `/fronting-sessions/:sessionId`     | Delete session (409 if it has dependents)          |

**Fronting comments** are nested under sessions:

```
POST   /fronting-sessions/:sessionId/comments
GET    /fronting-sessions/:sessionId/comments
PATCH  /fronting-sessions/:sessionId/comments/:commentId
DELETE /fronting-sessions/:sessionId/comments/:commentId
```

**Co-fronting model:** multiple sessions can be active simultaneously. There is no "current fronter" singular concept -- the client queries active sessions and displays all of them. A session is active when `endedAt` is null.

**Polymorphic subjects:** a fronting session references one of three subject types via nullable foreign keys:

- `memberId` -- a system member
- `customFrontId` -- an abstract cognitive state (e.g., "Dissociated", "Blurry")
- `structureEntityId` -- a structure entity (system-defined entity type)

Exactly one of these three fields is non-null per session.

**Switch alerts:** creating a fronting session automatically dispatches push notifications to eligible friends (fire-and-forget via the job queue). The client does not need to trigger this separately.

**Analytics endpoints** (under `/v1/systems/:systemId/analytics/`):

| Method | Path                     | Purpose                                   |
| ------ | ------------------------ | ----------------------------------------- |
| `GET`  | `/analytics/fronting`    | Duration/percentage breakdown per subject |
| `GET`  | `/analytics/co-fronting` | Co-fronting pair analysis                 |

Both accept date range query parameters:

| Parameter   | Description                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| `preset`    | `last-7-days`, `last-30-days`, `last-90-days`, `last-year`, `all-time`, or `custom` (default: `last-30-days`) |
| `startDate` | Unix millis, required when `preset=custom`                                                                    |
| `endDate`   | Unix millis, required when `preset=custom`                                                                    |

The fronting breakdown returns `SubjectFrontingBreakdown[]` with `totalDuration`, `sessionCount`, `averageSessionLength`, and `percentageOfTotal` per subject. The co-fronting endpoint returns `CoFrontingPair[]` with pair-level duration and overlap percentage. Pairs use canonical ordering (`memberA < memberB` lexicographically) to prevent duplicates.

### 8.2 Communication

The communication domain covers internal messaging, board posts, notes, polls, and acknowledgements.

**Channels and categories:**

Channels have a `type` field: `"category"` or `"channel"`. Categories are containers -- they hold channels via `parentId`. A channel with `parentId: null` is uncategorized. Messages are nested under channels:

```
POST   /channels                              Create channel or category
GET    /channels                              List channels
GET    /channels/:channelId                   Get channel
PATCH  /channels/:channelId                   Update channel
DELETE /channels/:channelId                   Delete channel (409 if has messages)

POST   /channels/:channelId/messages          Send message
GET    /channels/:channelId/messages           List messages
GET    /channels/:channelId/messages/:msgId    Get message
PATCH  /channels/:channelId/messages/:msgId    Edit message
DELETE /channels/:channelId/messages/:msgId    Delete message
```

**Messages:** chat messages have a `senderId` (member ID, T1 encrypted), `content` (T1), `attachments` (blob ID array), `mentions` (member ID array), and optional `replyToId` for threading.

**Board messages:** longer-form posts with `pinned` flag and `sortOrder`. Additional operations:

```
POST   /board-messages/:id/pin      Pin a message
POST   /board-messages/:id/unpin    Unpin a message
POST   /board-messages/reorder      Bulk reorder (accepts array of IDs with new sort orders, returns 204)
```

**Notes:** private notes with an optional polymorphic `author` field (`EntityReference<"member" | "structure-entity">`), `title`, `content`, and `backgroundColor`.

**Polls:** system-internal decision making with a full lifecycle:

1. **Create** -- set `kind` (`"standard"` or `"custom"`), options, voting rules (`allowMultipleVotes`, `maxVotesPerMember`, `allowAbstain`, `allowVeto`), and optional `endsAt` deadline
2. **Vote** -- members cast votes on options (`POST /:pollId/votes`). Null `optionId` indicates abstain. Votes can include a `comment` and `isVeto` flag
3. **Close** -- `POST /:pollId/close` transitions status from `"open"` to `"closed"` and sets `closedAt`
4. **Results** -- `GET /:pollId/results` returns vote tallies per option

Poll votes use an `EntityReference<"member" | "structure-entity">` for the voter, supporting structure entity participation.

**Acknowledgements:** a request-confirm pattern for system-internal accountability:

```
POST   /acknowledgements                     Create (sets createdByMemberId, targetMemberId, message)
POST   /acknowledgements/:id/confirm         Target member confirms (idempotent -- re-confirming returns current state)
GET    /acknowledgements                     List (filterable by confirmed status)
```

The `confirmed` field starts `false` and flips to `true` on confirmation. Once confirmed, `confirmedAt` is set. This is a one-way transition -- acknowledgements cannot be unconfirmed.

### 8.3 Privacy Buckets

Privacy buckets control what friends can see. They use tag-based intersection logic: a friend sees content only if they have been assigned **all** buckets that tag that content.

**Bucket CRUD:**

```
POST   /buckets              Create bucket
GET    /buckets               List buckets
GET    /buckets/:id           Get bucket
PATCH  /buckets/:id           Update bucket
DELETE /buckets/:id           Delete bucket (409 if has content tags or friend assignments)
```

**Content tagging** -- tag/untag entities into buckets:

```
POST   /buckets/:id/tags        Tag an entity (body: { entityType, entityId })
DELETE /buckets/:id/tags/:tagId  Untag an entity
GET    /buckets/:id/tags         List tags for a bucket
```

Supported entity types (21 total): `member`, `group`, `channel`, `message`, `note`, `poll`, `relationship`, `structure-entity-type`, `structure-entity`, `journal-entry`, `wiki-page`, `custom-front`, `fronting-session`, `board-message`, `acknowledgement`, `innerworld-entity`, `innerworld-region`, `field-definition`, `field-value`, `member-photo`, `fronting-comment`.

**Intersection logic:** if a member is tagged with buckets A and B, a friend must have both A and B assigned to see that member. If the friend only has A, the member is invisible to them. This is the **fail-closed** default: unmapped or errored content defaults to invisible.

**Field-level bucket visibility:** custom field definitions can be assigned bucket visibility, controlling which fields a friend can see on an entity even if they can see the entity itself:

```
POST   /buckets/:id/field-visibilities    Set field visible in bucket
DELETE /buckets/:id/field-visibilities/:id Remove field visibility
```

**Friend assignment** -- assign/unassign buckets to friends:

```
POST   /buckets/:id/friends       Assign bucket to friend (body: { connectionId, encryptedBucketKey, keyVersion })
DELETE /buckets/:id/friends/:id   Unassign bucket from friend
```

Note that assigning a bucket requires providing an `encryptedBucketKey` -- the client encrypts the bucket's symmetric key with the friend's public key so the friend can decrypt bucket-scoped (T2) content.

**Key rotation** is managed per-bucket:

```
GET    /buckets/:id/rotations     List rotation history
```

**Data export:**

```
GET    /buckets/:id/export        Export all content tagged with this bucket
```

### 8.4 Friend Network

Friend connections are managed under `/v1/account/` (account-scoped, not system-scoped).

**Friend code flow:**

1. **Generate code** -- `POST /v1/account/friend-codes` creates an `XXXX-XXXX` alphanumeric code (uppercase, 4+4 format). Codes are limited per account
2. **Redeem code** -- `POST /v1/account/friend-codes/redeem` with `{ "code": "ABCD-1234" }` creates a pending connection. Uses `friendCodeRedeem` rate limit category (stricter than normal writes)
3. **Accept/reject/block** -- the other party responds:
   - `POST /v1/account/friends/:connectionId/accept`
   - `POST /v1/account/friends/:connectionId/reject`
   - `POST /v1/account/friends/:connectionId/block`

**Friend management:**

```
GET    /v1/account/friends                         List friends
GET    /v1/account/friends/:connectionId           Get friend connection
POST   /v1/account/friends/:connectionId/remove    Remove friend
POST   /v1/account/friends/:connectionId/block     Block friend
GET    /v1/account/friends/:connectionId/visibility Get visibility settings
```

**Friend dashboard** -- read-only view of a friend's shared data, filtered by bucket visibility:

```
GET    /v1/account/friends/:connectionId/dashboard       Full dashboard snapshot
GET    /v1/account/friends/:connectionId/dashboard-sync  Incremental sync (cursor-based)
```

The dashboard returns only data that the viewing friend has bucket access to see. The server enforces intersection logic -- the client receives pre-filtered results.

**Friend data export:**

```
GET    /v1/account/friends/export    Export friend data with cursor pagination
```

**Per-friend notification preferences:**

```
GET    /v1/account/friends/:connectionId/notifications       Get notification prefs
PATCH  /v1/account/friends/:connectionId/notifications       Update notification prefs
```

Controls which notification event types (e.g., `friend-switch-alert`) this friend triggers for the account owner.

### 8.5 Push Notifications

Push notifications are system-scoped (a system registers its devices and configs).

**Device token registration:**

```
POST   /v1/systems/:systemId/device-tokens          Register token (body: { platform, token })
GET    /v1/systems/:systemId/device-tokens           List registered tokens
PATCH  /v1/systems/:systemId/device-tokens/:id       Update token
DELETE /v1/systems/:systemId/device-tokens/:id       Delete token
POST   /v1/systems/:systemId/device-tokens/:id/revoke  Revoke token
```

Supported platforms: `"ios"`, `"android"`, `"web"`. Token registration validates ownership -- a token can only belong to one account.

**Notification config** -- per-event-type toggle:

```
GET    /v1/systems/:systemId/notification-configs              List all configs
PATCH  /v1/systems/:systemId/notification-configs/:eventType   Update config
```

Event types: `switch-reminder`, `check-in-due`, `acknowledgement-requested`, `message-received`, `sync-conflict`, `friend-switch-alert`.

Each config has `enabled` (master toggle) and `pushEnabled` (push-specific toggle) flags. Both must be true for push delivery.

**Trigger flow:** when a fronting session is created, the API dispatches switch alert jobs to the queue. The push worker picks up the job, resolves eligible friends (based on notification preferences and bucket visibility), and delivers the push notification. This is entirely server-side -- the client only needs to register tokens and configure preferences.

---

## 9. Self-Hosted Considerations

Pluralscape supports self-hosted deployments. The API uses an adapter pattern for external services, so the client should not need to change behavior based on the hosting environment -- but there are subtle differences to be aware of.

**Adapter pattern:** the API injects service adapters at startup. The client interacts with the same REST endpoints regardless of which adapter is active behind the scenes.

**Email:** hosted deployments use the **Resend** adapter; self-hosted deployments use **SMTP/Nodemailer**. Both implement the same `EmailAdapter` interface. From the client's perspective, email-dependent flows (registration, password reset, email verification) work identically.

**Blob storage:** hosted deployments use **S3**; self-hosted deployments may use **MinIO** or a **filesystem** adapter. Key difference: the filesystem adapter does not support presigned URLs (`supportsPresignedUrls: false`). When the client requests a presigned upload/download URL, the response includes a `supported` field:

- `{ "supported": true, "url": "...", "expiresAt": ... }` -- use the presigned URL for direct upload/download
- `{ "supported": false }` -- fall back to proxied upload/download through the API

The client must handle both cases.

**Job queue:** hosted deployments use **BullMQ** backed by **Valkey** (Redis-compatible); self-hosted deployments use a **SQLite queue**. The SQLite queue is polled rather than event-driven, so background jobs (key rotation, push notifications, webhook delivery) may have slightly higher latency. The client should not assume instant job completion -- always poll for results rather than assuming synchronous processing.

**Further details:** see [ADR 012 -- Self-Hosted Tiers](../adr/012-self-hosted-tiers.md) for the full deployment tier architecture.
