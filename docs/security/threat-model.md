# Security Threat Model

This document captures known security findings from internal audits, documents the mitigations in place, and identifies residual risks that must be addressed before production deployment. It covers deployment infrastructure, protocol-level concerns, and the device transfer flow.

Throughout this document, severity labels (M2, M3, M4, L6, M5, M6, M7) reference findings from the Pluralscape security audit series.

## Overview

Pluralscape is an E2E encrypted application built on libsodium (XChaCha20-Poly1305, X25519, Argon2id). The server operates in a zero-knowledge model: all user content is encrypted client-side before transmission, and the server stores only ciphertext. This architecture provides strong defense-in-depth — even when infrastructure-level controls have gaps, the encrypted content remains unreadable to an attacker who compromises the server or its backing services.

Key architectural properties relevant to this threat model:

- **Zero-knowledge server**: The API never sees plaintext user data. All sensitive fields are encrypted with per-bucket symmetric keys distributed via asymmetric encryption (see ADR 006).
- **Fail-closed privacy**: Unmapped or errored privacy data defaults to maximum restriction (invisible to all).
- **Opaque identifiers**: Document and entity IDs are UUIDs with no embedded semantic information.
- **AEAD integrity**: XChaCha20-Poly1305 provides both confidentiality and tamper detection on all encrypted payloads.

---

## Deployment Security

### Valkey (Redis-compatible) — M2

**Finding**: The Valkey instance used for pub/sub message routing, rate limiting, and job queues has no documented deployment security requirements. A misconfigured Valkey instance could allow unauthorized access to rate limit state, job queue payloads, and pub/sub channels.

**Current state**: Valkey is used as a pub/sub backbone for horizontal WebSocket scaling (ADR 007) and as a backing store for BullMQ job queues (ADR 010). Pub/sub messages flowing through Valkey are not independently authenticated — any client with network access to the Valkey instance can subscribe to channels and observe message envelopes.

**Defense-in-depth**: All pub/sub payloads relay E2E encrypted content. An attacker who gains access to Valkey can observe message metadata (channel names, timing, envelope sizes) but cannot decrypt the content. Rate limit counters and job queue metadata are the primary exposure.

#### Deployment requirements

The following must be enforced in all deployment configurations (Docker Compose, Kubernetes, bare metal):

1. **Authentication**: Enable `requirepass` in the Valkey configuration. Use a strong, randomly generated password (minimum 32 characters). Store the password in environment variables or a secrets manager, never in version-controlled configuration files.

2. **Network binding**: Bind Valkey to `127.0.0.1` (localhost) or a private network interface. Never expose Valkey on `0.0.0.0` or a public-facing interface.

3. **TLS**: When Valkey runs on a separate host from the API server (e.g., in Kubernetes with dedicated Valkey pods), enable TLS for the connection. Mutual TLS (mTLS) is recommended for multi-tenant infrastructure.

4. **ACL restrictions**: Use Valkey ACLs to create a dedicated user for the Pluralscape application with permissions limited to the specific key prefixes and channels in use. Disable the default user or restrict it to local admin access only.

5. **Firewall rules**: Restrict inbound connections to the Valkey port (default 6379) to only the API server hosts. No other services or networks should have access.

#### Future hardening

- **HMAC-signed envelopes**: Pub/sub messages are currently unauthenticated plain envelopes wrapping encrypted content. Adding HMAC signatures (using a shared application secret) to pub/sub envelopes would prevent a Valkey-compromised attacker from injecting forged messages into the pub/sub channels. This is a defense-in-depth measure — the encrypted content itself has AEAD integrity, so injected messages would fail client-side decryption, but signed envelopes would prevent the injection entirely.

- **Encrypted job payloads**: BullMQ job data that contains metadata (e.g., account IDs, system IDs in job arguments) could be encrypted at the application layer before enqueuing, reducing metadata exposure if Valkey is compromised.

---

## Protocol Security

### Document Ownership (TOFU) — M3

**Finding**: The sync relay uses Trust On First Use (TOFU) for document ownership binding. Before a document's first write, document metadata (existence, timing, sizes) is observable by any authenticated WebSocket connection that knows or guesses a document ID.

**Current state**: The `RouterContext.documentOwnership` field in the WebSocket message router (see `apps/api/src/ws/message-router.ts`) is a per-process `Map<string, SystemId>` that binds a document ID to a system ID on the first write operation. Until that binding occurs, any authenticated connection can subscribe to a document ID and observe updates. The ownership map is ephemeral (in-memory, lost on server restart).

**Why this is acceptable for now**:

1. **E2E encryption**: All document content is encrypted. An attacker who subscribes to a document they do not own receives only ciphertext that they cannot decrypt.
2. **Opaque document IDs**: Document identifiers are UUIDs. There is no enumeration endpoint — an attacker would need to guess a valid document ID (122 bits of entropy for UUID v4).
3. **Ephemeral relay**: The sync relay holds documents in memory with LRU eviction. Documents are not persisted server-side; they exist only while actively syncing.

**Residual risk**: An attacker with a valid session could observe metadata about a document if they know its ID:

- Whether a document exists (subscription succeeds)
- Timing of updates (pub/sub notifications)
- Approximate sizes of encrypted payloads

This metadata leakage is low-severity given the opaque ID requirement and zero-knowledge content model, but it violates the principle of minimum information exposure.

#### Recommendation

Before production, verify document ownership against the `sync_documents` table on subscribe and read operations. The relay should reject subscriptions for documents that belong to a different system than the authenticated connection's system ID. This converts the TOFU model to a verified ownership model:

```
subscribe(docId) → query sync_documents WHERE document_id = docId AND system_id = auth.systemId → allow/deny
```

This check should apply to both subscribe requests and snapshot/change fetch operations.

---

## Device Transfer Security

### Transfer Code Entropy — M4

**Finding**: The device transfer verification code is 8 decimal digits, providing approximately 26.5 bits of entropy (log2(10^8)). While multiple compensating controls protect against online brute-force, offline attacks against exfiltrated transfer data are feasible.

**Current state**: The transfer protocol (see `packages/crypto/src/device-transfer.ts` and ADR 024) derives a symmetric key from the 8-digit code via Argon2id (mobile profile: 2 iterations, 32 MiB memory). The encrypted master key is transmitted through a server relay during the 5-minute transfer window.

#### Online brute-force protection

Online attacks are well-mitigated by multiple overlapping controls:

| Control          | Detail                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Attempt limiting | Maximum 5 incorrect attempts per transfer session (`MAX_TRANSFER_CODE_ATTEMPTS`). After 5 failures, the transfer is expired server-side.                                                          |
| Rate limiting    | Initiation is limited to 3 per hour per account (`TRANSFER_INITIATION_LIMIT`). Completion is limited to 5 attempts per transfer session (`MAX_TRANSFER_CODE_ATTEMPTS` per `TRANSFER_TIMEOUT_MS`). |
| Session timeout  | Transfer sessions expire after 5 minutes (`TRANSFER_TIMEOUT_MS = 300_000`). The server destroys the encrypted payload after expiry.                                                               |
| KDF cost         | Each attempt requires a full Argon2id computation (~250ms on mobile hardware), preventing rapid local enumeration.                                                                                |

At 5 attempts per transfer and 3 transfer initiations possible per hour (the account-level initiation limit), an online attacker can test at most 15 codes per hour — exhausting the 10^8 keyspace would take approximately 760,000 years.

#### Offline brute-force exposure

If an attacker exfiltrates the transfer session data from the database (the Argon2id salt and the encrypted master key ciphertext), they can brute-force the 8-digit code offline without server-side rate limiting.

**Attack parameters**:

- Keyspace: 10^8 (100 million combinations)
- Argon2id mobile profile: 2 iterations, 32 MiB memory
- Estimated throughput on 4x RTX 4090: ~1,000 hashes/second (per hashcat benchmarks for Argon2id with 32 MiB, as of 2026 — revisit as GPU capabilities evolve)
- Time to exhaustion: approximately 28 hours

**Mitigating factors**: This attack requires database access (a severe compromise on its own) and only captures transfers that are in-flight during the 5-minute window. Under normal operation, transfer sessions are ephemeral.

#### Recommendations

1. **Increase code length before production**: Extending to 10 digits raises the keyspace to 10^10 (~33.2 bits), increasing offline brute-force time to approximately 116 days on the same hardware. 12 digits (~39.9 bits) would push it to approximately 31 years. The usability trade-off is documented in ADR 024; 10 digits is a reasonable compromise.

2. **Delete transfer records after completion or expiry**: Completed and expired transfer sessions should be purged from the database immediately, eliminating the persistent ciphertext that enables offline attack. The cleanup job should zero the encrypted payload and salt columns, then delete the row.

3. **Consider server KDF profile**: Using the server Argon2id profile (4 iterations, 64 MiB) instead of the mobile profile would increase the offline brute-force cost by approximately 4× (iterations double from 2 to 4 and memory doubles from 32 to 64 MiB). The trade-off is slower transfer completion on low-end mobile devices.

### QR Payload — L6

**Finding**: The QR code generated during device transfer contains the verification code in cleartext alongside the request ID and Argon2id salt. An attacker who photographs or screen-captures the QR code obtains all the information needed to complete the transfer.

**Current state**: The `encodeQRPayload` function in `packages/crypto/src/device-transfer.ts` encodes a JSON object containing `requestId`, `code`, and `salt` (hex-encoded). The QR code is designed as a convenience mechanism — scanning it replaces manual code entry, transferring all three values in a single step.

**Security model**: The QR code's security relies entirely on the physical proximity assumption: only someone with direct line-of-sight to the source device's screen can capture the QR code. This is a single-factor model (physical access to the display).

**Residual risks**:

- **Screen sharing or remote desktop**: If the source device is sharing its screen (video call, remote support session), the QR code is visible to remote observers.
- **Shoulder surfing**: In shared spaces, the QR code may be visible to nearby individuals.
- **Screenshot malware**: Malware with screen capture capabilities could exfiltrate the QR code.
- **Persistent QR image**: If the user takes a screenshot of the QR code (e.g., to transfer later), the code persists beyond the 5-minute session window but remains valid until the session expires.

#### Recommendation

The codebase already contains comments documenting a two-factor upgrade path (see the file-level JSDoc in `packages/crypto/src/device-transfer.ts`):

> To enable two-factor verification, remove `code` from QR payload and require separate manual entry on the target device.

This upgrade splits the transfer into two factors:

1. **QR scan** (something you have access to): Transfers the `requestId` and `salt`
2. **Manual code entry** (something you know): The 8-digit code displayed separately on the source device

With this change, capturing the QR code alone is insufficient to complete a transfer — the attacker must also observe and transcribe the displayed code.

This should be implemented before production. The change is backward-compatible: the `decodeQRPayload` function can accept payloads with or without the `code` field, falling back to requiring manual entry when the code is absent.

---

## Communication Security — M5

### Proxy Messaging Trust Model

**Finding**: The chat system is proxy-based — channels route messages through the server, and the server stores and relays ciphertext. An attacker who compromises the server can observe message metadata (sender, channel, timestamp, ciphertext length) but cannot read message content.

**Current state**: Messages are stored server-side as E2E encrypted payloads (XChaCha20-Poly1305). The server acts as a relay only; it has no key material to decrypt messages. Channel membership is system-scoped: channels belong to a system, and all access is gated by `assertSystemOwnership` before any channel or message operation.

**Defense-in-depth**: The zero-knowledge server model limits metadata exposure. An attacker with database access can observe that a system has channels with a certain number of messages, and approximate timing, but cannot read any message content. There is no cross-system channel access — channels cannot be shared between systems, eliminating the risk of a compromised system being used to eavesdrop on another system's communications.

#### Deployment requirements

No additional deployment controls beyond the baseline (TLS in transit, database authentication). The channel access control model is enforced at the application layer on every request.

---

### Channel Access Control

**Finding**: Channel access is enforced by system ownership at the route layer, but the channel data model (channels, categories, messages) must correctly scope all queries to the owning system to prevent IDOR.

**Current state**: All communication routes are nested under `/v1/systems/:systemId/`, which applies `assertSystemOwnership` before any handler logic. Channel and message queries include `system_id` predicates derived from the authenticated session, not from client-supplied parameters.

**Residual risk**: None identified for the current route structure. The IDOR surface is constrained by the monolithic system-ownership check applied to all system-scoped routes.

---

## Privacy Engine — M6

### Bucket Intersection Logic (Fail-Closed)

**Finding**: The privacy bucket system uses intersection-based access control to determine friend visibility. The correctness of the intersection logic and the behavior on error are security-critical.

**Current state**: Privacy buckets use a tag-intersection model: an entity is visible to a friend only if the entity's bucket tags and the friend's assigned buckets share at least one tag (intersection non-empty). The system is explicitly fail-closed: if a bucket assignment is missing, cannot be resolved, or errors during evaluation, the result is invisibility (the entity is not shown to the friend). This mirrors the architectural property documented in the Overview section.

**Defense-in-depth**: The fail-closed default means misconfiguration or a partially migrated account produces over-restriction (entities invisible) rather than over-exposure (entities leaked). An error in the privacy evaluation path cannot cause data leakage.

#### Mitigations

- Bucket filtering is SQL-pushed (not post-hoc in application code), so the database enforces visibility at query time.
- The M6 audit identified and fixed a member count leak: member count endpoints now apply the same bucket filtering as member list endpoints.

---

### Friend Network Access Control

**Finding**: Friend-to-friend data access uses a bucket-scoped read model. The external dashboard endpoint exposes a read-only projection of a system's data filtered by the viewing friend's assigned buckets.

**Current state**: The external dashboard endpoint (`/v1/account/friends/:connectionId/dashboard`) is accessible to authenticated accounts who are confirmed friends of the target system. All data returned is filtered through the bucket visibility model — only entities in buckets the viewer has been assigned are included.

**Residual risk**: The friend access model relies on the friend connection being properly validated (accepted, not blocked/removed) at query time. The friend connection state is checked on every request, not cached, so revocation takes effect immediately on the next request.

---

### Device Token Takeover Prevention

**Finding (M6 audit)**: Device token registration must validate ownership to prevent a compromised or malicious client from registering push tokens for another account's devices.

**Current state**: Device token registration requires an authenticated session. The token is bound to the authenticated account and system — a session cannot register tokens for a different account. Tokens are cleared when a device session is revoked (via the session revocation endpoint), preventing a revoked session from continuing to receive push notifications.

**Defense-in-depth**: Ownership validation is enforced at registration and at the revocation boundary. A token that survives session revocation would only receive notifications that the owning system authorizes — the notification payload does not contain plaintext system data.

---

## Email Security — M7

### Server-Side Email Encryption (ADR 029)

**Finding**: Email addresses stored in the accounts table represent a privacy-sensitive identifier. Storing them in plaintext creates exposure risk if the database is compromised.

**Current state**: Email addresses are stored encrypted using AES-256-GCM with a server-side key. A BLAKE2b hash of the email address is stored alongside the ciphertext to enable deterministic lookup (login, deduplication) without decrypting. The plaintext email address is never persisted; it is encrypted immediately on account creation and on any update.

**Defense-in-depth**: An attacker with read-only access to the database cannot recover email addresses without the server-side encryption key. The BLAKE2b hash enables login lookups without decryption but is not reversible — the hash cannot be used to recover the plaintext email. The AES-256-GCM authentication tag provides tamper detection on the ciphertext.

**Residual risk**: The server-side encryption key is a shared secret that, if compromised, exposes all stored email addresses. Key management for the email encryption key must follow the same security controls as other application secrets (secrets manager, rotation policy, never in version-controlled config).

#### Deployment requirements

1. **Key management**: The email encryption key must be stored in an environment variable or secrets manager. It must not appear in version-controlled configuration files.
2. **Key rotation**: If the key is rotated, all stored email ciphertexts must be re-encrypted. A rotation procedure is needed before production.

---

## Webhook Security — M7

### HMAC Payload Signing

**Finding**: Webhook deliveries must be authenticated so that receiving endpoints can verify the payload originated from Pluralscape and was not tampered with in transit.

**Current state**: All webhook deliveries are signed with HMAC-SHA256 using a per-webhook secret generated at webhook creation. The signature is included in the `X-Pluralscape-Signature` header. Receiving endpoints can verify the signature against the payload body using the shared secret.

**Defense-in-depth**: HMAC-SHA256 provides both authenticity (only the holder of the secret can produce a valid signature) and integrity (any modification to the payload invalidates the signature). The secret is generated server-side with libsodium's CSPRNG and is never logged.

---

### Webhook Secret Rotation

**Finding**: Webhook secrets may need to be rotated if they are compromised or as part of a regular rotation schedule. Rotation must not cause delivery failures for in-flight events.

**Current state**: The secret rotation endpoint (ADR 027) supports a grace period: during rotation, the old secret and new secret are both valid for a configurable overlap window. This prevents a hard cutover that would invalidate signatures for deliveries already in transit. After the grace period, only the new secret is valid.

**Residual risk**: During the grace period, a compromised old secret can still be used to forge valid signatures. The grace period should be as short as operationally feasible.

---

### Optional Payload Encryption

**Finding**: Webhook payloads contain metadata about system events (member fronts, friend activity, etc.). A webhook receiver that processes payloads over a compromised connection could expose event metadata.

**Current state**: Payload encryption is available as an opt-in feature, using the API key associated with the webhook configuration. When enabled, the payload body is encrypted before transmission, providing confidentiality in addition to HMAC integrity.

**Residual risk**: Payload encryption is opt-in; most webhook receivers will use HMAC signing only. Receivers are responsible for ensuring their endpoint handles incoming webhooks over HTTPS.

---

### Delivery Worker and Retry

**Finding**: Webhook delivery failures (network errors, non-2xx responses from receiver) must be retried reliably without creating unbounded retry storms.

**Current state**: The webhook delivery worker uses exponential backoff with jitter for retries. Terminal delivery records (success or permanent failure after max retries) are auto-purged after 30 days by the cleanup job. This bounds storage growth from delivery history.

---

## Auth Hardening — M7

### Anti-Enumeration (M7 Audit)

**Finding (M7 audit — high priority)**: Auth endpoints must return constant-time, indistinguishable responses for valid and invalid inputs to prevent user enumeration by timing or response content.

**Current state**: The following protections are implemented:

- **Login**: Returns a generic "Invalid email or password" response regardless of whether the email exists. A dummy Argon2 computation is performed when the email is not found, equalizing response time with the successful-lookup-but-wrong-password path.
- **Registration**: Returns a fake session response on duplicate email registration, indistinguishable from a successful registration to an external observer.
- **Password reset**: Returns a generic "Invalid email or recovery key" response regardless of whether the account exists.

**Defense-in-depth**: The combined use of constant-time string comparison and dummy KDF computations prevents both timing-based and response-based enumeration attacks.

---

### Session Idle Filter Fail-Closed Gap (M7 Audit — fixed)

**Finding (M7 audit — low priority)**: The session idle filter returned `null` for unknown session types, which could cause the filter to skip idle enforcement for custom or future session types (fail-open).

**Current state (fixed)**: The session idle filter now treats unknown session types as an error rather than silently permitting them. Unknown session types cause the request to be rejected, ensuring the filter is fail-closed. This was identified in the M7 audit and fixed inline.

---

### Password Change Session Revocation (M7 Audit — documented)

**Finding (M7 audit — high priority, intentional)**: On password change, all sessions except the current session are revoked. A compromised device that holds a session initiated before the password change retains access until that session's absolute TTL expires or the session is explicitly revoked by the user.

**Current state**: This is an intentional UX decision — revoking all other sessions on password change prevents the user from being locked out of all devices simultaneously if the password change was itself initiated from a compromised session. The behavior is documented here as a known residual risk.

**Residual risk**: If an attacker has obtained a session token and the user changes their password without explicitly revoking all sessions, the attacker's session remains valid until TTL. Users who suspect a compromise should use the session management interface to explicitly revoke all sessions.

**Recommendation**: Surface a "revoke all other sessions" option prominently during and after password change to make it easy for users who want the stronger security guarantee.

---

## Out of Scope

The following areas were assessed during the audit but are not covered by this document. They are governed by their respective ADRs.

| Area             | ADR     | Summary                                                                                                                                    |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Session security | ADR 013 | Hybrid token model with metadata/crypto key separation; zero-knowledge revocation without server-side key material                         |
| Blob storage     | ADR 009 | S3-compatible storage with mandatory client-side encryption; presigned URLs for upload/download; server never holds plaintext blob content |
| Key recovery     | ADR 011 | Recovery key shown once at registration; permanent data loss without recovery key or active device by design                               |

---

## Recommendations

Prioritized list of pre-production security tasks, ordered by severity and implementation effort.

### Priority 1 — Before production launch

| Finding | Action                                                                                                                                                                                           | Effort |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| M2      | Document and enforce Valkey deployment security checklist in the self-hosting guide. Add connection validation on startup (verify `requirepass` is set, refuse to start without authentication). | Low    |
| M4      | Increase transfer code length to 10+ digits. Update `TRANSFER_CODE_LENGTH`, adjust validation patterns, and update ADR 024.                                                                      | Low    |
| M4      | Implement transfer record deletion on completion/expiry. Ensure the cleanup job zeroes encrypted payload and salt before deleting.                                                               | Low    |
| L6      | Remove verification code from QR payload. Require manual code entry as a second factor. Update `encodeQRPayload`/`decodeQRPayload` accordingly.                                                  | Low    |
| M3      | Add ownership verification on document subscribe/read operations against the `sync_documents` table.                                                                                             | Medium |

### Priority 2 — Post-launch hardening

| Finding | Action                                                                                                                                | Effort |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| M2      | Add HMAC-signed envelopes to Valkey pub/sub messages to prevent message injection by a Valkey-compromised attacker.                   | Medium |
| M2      | Encrypt BullMQ job payloads containing metadata (account IDs, system IDs) at the application layer.                                   | Medium |
| M4      | Evaluate switching to server Argon2id profile (4 iterations, 64 MiB) for transfer KDF, benchmarking impact on low-end mobile devices. | Low    |
| M7      | Define and document email encryption key rotation procedure before production.                                                        | Medium |
| M7      | Surface "revoke all other sessions" option prominently during and after password change.                                              | Low    |
| M7      | Shorten webhook secret rotation grace period guidance in self-hosting docs.                                                           | Low    |

### References

- ADR 006: Encryption (libsodium, key hierarchy, Privacy Bucket model)
- ADR 007: Real-Time (Valkey as pub/sub backbone)
- ADR 010: Background Jobs (BullMQ with Valkey)
- ADR 013: API Authentication with E2E Encryption
- ADR 024: Device Transfer Code Entropy Trade-off
- ADR 027: Webhook Secret Rotation Procedure
- ADR 029: Server-Side Encrypted Email Storage
- `packages/crypto/src/device-transfer.ts` (transfer protocol implementation, `TRANSFER_TIMEOUT_MS`)
- `apps/api/src/ws/message-router.ts` (TOFU document ownership)
- `apps/api/src/routes/account/device-transfer.constants.ts` (`MAX_TRANSFER_CODE_ATTEMPTS`, `TRANSFER_INITIATION_LIMIT`)
- `apps/api/src/lib/session-auth.ts` (idle filter fail-closed fix)
- `apps/api/src/services/account.service.ts` (password change session revocation)
