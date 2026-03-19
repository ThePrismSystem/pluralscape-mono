# Attack Surface Map — Pluralscape

## Entry Points

### Public (Unauthenticated)

| Endpoint                            | Method | Rate Limit        | Vectors                                             |
| ----------------------------------- | ------ | ----------------- | --------------------------------------------------- |
| `/auth/register`                    | POST   | authHeavy (5/min) | Credential stuffing, timing oracle, Argon2id DoS    |
| `/auth/login`                       | POST   | authHeavy (5/min) | Brute force, timing oracle, audit write timing leak |
| `/auth/password-reset/recovery-key` | POST   | authHeavy (5/min) | Recovery key brute force, email enumeration         |

### Authenticated

| Endpoint Group                 | Methods     | Rate Limit                           | Vectors                        |
| ------------------------------ | ----------- | ------------------------------------ | ------------------------------ |
| `/account/*`                   | GET, POST   | authHeavy (5/min) for writes         | IDOR, account takeover         |
| `/account/audit-log`           | GET         | auditQuery (30/min)                  | PII exposure, pagination abuse |
| `/systems/:systemId/*`         | All CRUD    | write (60/min), readDefault (60/min) | Cross-system access, IDOR      |
| `/systems/:systemId/members/*` | All CRUD    | write/readDefault                    | IDOR on member data            |
| `/systems/:systemId/blobs/*`   | All         | blobUpload (20/min), readDefault     | Path traversal, quota bypass   |
| `/systems/:systemId/buckets/*` | All         | write (60/min)                       | Key rotation race conditions   |
| `/auth/sessions`               | GET, DELETE | authLight (20/min)                   | Session fixation, TOCTOU       |
| `/auth/biometric`              | POST        | authHeavy (5/min)                    | Token replay                   |

### Infrastructure

| Component          | Exposure       | Vectors                                          |
| ------------------ | -------------- | ------------------------------------------------ |
| PostgreSQL         | Internal       | RLS bypass, SQL injection (mitigated by ORM)     |
| Valkey/Redis       | Internal       | Rate limit state manipulation                    |
| S3/MinIO           | Presigned URLs | Time-limited URL leakage, blob enumeration       |
| Filesystem storage | Local          | Path traversal (mitigated by multi-layer checks) |

## Data Flows

### Authentication Flow

```
Client                    API Server                    Database
  |                          |                             |
  |-- POST /auth/login ----->|                             |
  |   (email, password)      |-- hashEmail(email) -------->|
  |                          |<-- account row (or null) ---|
  |                          |                             |
  |                          |-- verifyPassword() -------->|
  |                          |   (Argon2id, 256MB)         |
  |                          |                             |
  |                          |-- INSERT session ---------->|
  |                          |   (id, tokenHash, TTLs)     |
  |<-- { sessionToken } -----|                             |
```

### Blob Upload Flow

```
Client                    API Server           S3/Storage
  |                          |                     |
  |-- POST /upload-url ----->|                     |
  |   (systemId, purpose)    |                     |
  |                          |-- assertOwnership ->|
  |                          |-- INSERT metadata ->|
  |                          |                     |
  |                          |-- getPresignedUrl ->|
  |<-- { uploadUrl, id } ----|                     |
  |                          |                     |
  |-- PUT uploadUrl -------->|===================>|
  |   (encrypted blob)       |                     |
  |                          |                     |
  |-- POST /confirm -------->|                     |
  |   (blobId, checksum)     |-- UPDATE metadata ->|
  |<-- { confirmed } --------|                     |
```

### Key Distribution Flow

```
System Owner              API Server              Friend
  |                          |                       |
  |-- Create bucket key ---->|                       |
  |   (symmetric AEAD key)   |                       |
  |                          |                       |
  |-- Grant key to friend -->|                       |
  |   (encrypted with        |                       |
  |    friend's public key)  |-- INSERT key_grant -->|
  |                          |                       |
  |                          |<-- GET key_grant -----|
  |                          |-- encrypted key ----->|
  |                          |   (asymmetric box)    |
```

## Abuse Paths

### Path 1: Login Timing Oracle -> Email Enumeration

```
Attacker sends login requests with candidate emails
  -> Measures response time difference
  -> "Not found" path: Argon2id + return (fast)
  -> "Wrong password" path: Argon2id + audit write + return (slower)
  -> Statistical analysis reveals valid emails
  -> Mitigated by: rate limit (5/min), small timing delta
```

### Path 2: Device Transfer Code Brute Force

```
Attacker captures QR code or transfer request ID + salt
  -> 8 decimal digits = 10^8 possibilities
  -> Argon2id mobile profile (32MB/2 iter) slows offline attempts
  -> 5-minute timeout limits online attempts
  -> ~28 hours offline brute force on modern GPU (theoretical)
  -> Mitigated by: timeout, rate limiting, physical proximity requirement
```

### Path 3: Session Fixation via Race Condition

```
Two concurrent session revocation requests for same session
  -> Thread A: pre-transaction check passes
  -> Thread B: pre-transaction check passes
  -> Thread A: transaction UPDATE succeeds
  -> Thread B: transaction UPDATE finds 0 rows (already revoked)
  -> Impact: benign (double-revocation), no security breach
```

### Path 4: Quota Bypass via Concurrent Uploads

```
Attacker sends many concurrent blob upload requests
  -> Each passes quota check independently
  -> All confirmed before quota re-checked
  -> Mitigated by: rate limit (20 uploads/min), eventual consistency check
```
