# Security Threat Model

This document captures known security findings from internal audits, documents the mitigations in place, and identifies residual risks that must be addressed before production deployment. It covers deployment infrastructure, protocol-level concerns, and the device transfer flow.

Throughout this document, severity labels (M2, M3, M4, L6) reference findings from the Pluralscape security audit series.

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

### References

- ADR 006: Encryption (libsodium, key hierarchy, Privacy Bucket model)
- ADR 007: Real-Time (Valkey as pub/sub backbone)
- ADR 010: Background Jobs (BullMQ with Valkey)
- ADR 013: API Authentication with E2E Encryption
- ADR 024: Device Transfer Code Entropy Trade-off
- `packages/crypto/src/device-transfer.ts` (transfer protocol implementation, `TRANSFER_TIMEOUT_MS`)
- `apps/api/src/ws/message-router.ts` (TOFU document ownership)
- `apps/api/src/routes/account/device-transfer.constants.ts` (`MAX_TRANSFER_CODE_ATTEMPTS`, `TRANSFER_INITIATION_LIMIT`)
