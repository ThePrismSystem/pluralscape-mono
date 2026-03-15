# Attack Surface Map — Pluralscape

## Entry Points

### HTTP API (Hono on Bun)

| Endpoint  | Method | Auth Required | Notes                                                  |
| --------- | ------ | ------------- | ------------------------------------------------------ |
| `/`       | GET    | No            | Returns `{ status: "ok", service: "pluralscape-api" }` |
| `/health` | GET    | No            | Returns `{ status: "healthy" }`                        |

**Note:** The API is in early development. Only 2 routes exist. No auth, CRUD, or tRPC endpoints are implemented yet. tRPC and Zod dependencies are installed but unused.

### Sync Protocol (WebSocket)

| Message               | Direction      | Auth          | Notes                           |
| --------------------- | -------------- | ------------- | ------------------------------- |
| AuthenticateRequest   | Client->Server | sessionToken  | Initiates sync session          |
| ManifestRequest       | Client->Server | Authenticated | Lists available documents       |
| SubscribeRequest      | Client->Server | Authenticated | Real-time updates for documents |
| SubmitChangeRequest   | Client->Server | Authenticated | Submit encrypted CRDT change    |
| SubmitSnapshotRequest | Client->Server | Authenticated | Submit encrypted snapshot       |
| FetchChangesRequest   | Client->Server | Authenticated | Pull changes since seq          |
| FetchSnapshotRequest  | Client->Server | Authenticated | Pull latest snapshot            |
| DocumentLoadRequest   | Client->Server | Authenticated | On-demand document loading      |

### Client-Side Entry Points

| Surface             | Input Type        | Validation                                                        |
| ------------------- | ----------------- | ----------------------------------------------------------------- |
| Password entry      | String            | Non-empty check only (no complexity validation in crypto layer)   |
| Recovery key entry  | String (base32)   | Format validation: 13 groups of 4 chars (A-Z, 2-7)                |
| Transfer code entry | String (8 digits) | Pattern validation: `/^\d{8}$/`                                   |
| QR code scan        | JSON string       | Schema validation: requestId, code, salt fields; hex salt parsing |
| Friend code         | String (8+ chars) | Minimum length check in schema                                    |

## Data Flows

### Authentication Flow (Designed, Not Implemented)

```
Password -> TextEncoder -> Argon2id(password, salt, profile) -> passwordKey (KEK)
                                                                      |
                                                              unwrapMasterKey(encryptedMasterKey, KEK)
                                                                      |
                                                              masterKey (DEK) -> KDF subkeys
                                                                      |
                                                    +--------+--------+--------+
                                                    |        |        |        |
                                              identity   data-encr   sync    bucket
                                              keys       T1 key     key     keys
```

### Device Transfer Flow

```
Source Device:                           Target Device:
  generateTransferCode()                   [scan QR or enter code]
  -> verificationCode (8 digits)              |
  -> codeSalt (16 bytes random)           decodeQRPayload(data)
  -> requestId (UUID v4)                      |
       |                                  deriveTransferKey(code, salt)
  encodeQRPayload(init)                       |
  -> JSON { requestId, code, salt }       decryptFromTransfer(payload, transferKey)
       |                                      |
  deriveTransferKey(code, salt)           masterKey recovered
       |                                      |
  encryptForTransfer(masterKey, transferKey)   transferKey memzeroed
       |
  transferKey memzeroed
```

### Sync Encryption Flow

```
Automerge.change(doc)
  -> change bytes
  -> AEAD encrypt(change, encryptionKey, AAD=documentId)
  -> Ed25519 signDetached(ciphertext, signingKey)
  -> EncryptedChangeEnvelope { ciphertext, nonce, signature, authorPublicKey }
  -> relay/network

Receiving:
  -> verifySignature(envelope.signature, envelope.ciphertext, envelope.authorPublicKey)
  -> AEAD decrypt(ciphertext, nonce, AAD=documentId, encryptionKey)
  -> Automerge.applyChanges(doc, change)
```

### Key Grant Flow (Friend Sharing)

```
Owner:
  buildEnvelope(bucketId, keyVersion, bucketKey)
  -> crypto_box(envelope, recipientPublicKey, senderSecretKey)
  -> [24B nonce || ciphertext] stored in keyGrants table

Friend:
  boxOpenEasy(ciphertext, nonce, senderPublicKey, recipientSecretKey)
  -> parseEnvelope(plaintext, expectedBucketId, expectedKeyVersion)
  -> bucketKey recovered
```

## Abuse Paths

### 1. Missing Auth Middleware -> Full API Access

**Current State:** API has no authentication middleware. When routes are added, any unauthenticated client can access them unless auth is implemented first.
**Chain:** Unauthenticated request -> Hono route handler -> Database query -> Data exposure
**Impact:** Critical (when API endpoints are implemented)

### 2. Transfer Code Brute Force

**Scenario:** Attacker intercepts requestId from relay, brute-forces 8-digit code offline with captured salt.
**Chain:** Capture salt + requestId -> Offline Argon2id brute force (10^8 possibilities) -> Decrypt master key
**Mitigations:** Argon2id (mobile: 2 ops, 32 MiB), 5-minute session timeout
**Impact:** High (master key compromise if salt is captured)

### 3. Webhook Secret Compromise -> Signature Forgery

**Scenario:** Database breach exposes T3 webhook secrets.
**Chain:** DB compromise -> Read webhookConfigs.secret -> Forge HMAC signatures -> Inject fake webhook payloads to consumers
**Impact:** Medium (depends on webhook consumer trust)

### 4. RLS Bypass via Missing Context

**Scenario:** API handler forgets to call setTenantContext() before query.
**Chain:** Missing setTenantContext() -> GUC vars are NULL -> RLS policies return no rows (fail-closed)
**Impact:** Low (fail-closed design prevents data leakage; results in denial of service for that request)

### 5. SQLite Application-Layer Isolation Bypass

**Scenario:** Bug in mobile app skips accountScope/systemScope filtering.
**Chain:** Missing scope filter -> Query returns all rows in local DB -> Cross-system data exposure
**Impact:** Medium (limited to local device; multi-system scenarios only)

### 6. Key Version Mismatch

**Scenario:** Crypto layer accepts keyVersion=0 but DB requires >= 1.
**Chain:** Create key grant with version 0 -> Crypto succeeds -> DB insert fails or creates inconsistency
**Impact:** Low (would cause errors, not security breach)
