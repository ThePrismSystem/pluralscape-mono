# M7 Comprehensive Documentation Update

Comprehensive audit and update of all project documentation, plus a new API consumer guide in preparation for M8 (client app) work.

## Goals

1. Audit every doc in the repo for staleness against current codebase state
2. Update stale docs to reflect M4-M7 implementation work and audit remediation
3. Create new docs that capture patterns/decisions that emerged from audit work (response envelope, idempotency, security headers)
4. Write a comprehensive API consumer guide for building the Expo client app
5. Ensure existing docs are accurate enough that M8 work can proceed with solid context

## Scope

### Documents to Update

**Root-level:**
- `README.md` — status section (M7 progress), coverage numbers, E2E test count, feature summary
- `CONTRIBUTING.md` — dev setup prerequisites, test commands, TDD section, ADR count
- `CHANGELOG.md` — verify M7 entries are complete, add missing entries
- `VALUES.md` — read and verify
- `CODE_OF_CONDUCT.md` — read and verify
- `SECURITY.md` — verify disclosure process and contact info

**`docs/planning/`:**
- `milestones.md` — mark completed M7 epics, verify M8 epic list
- `features.md` — cross-check feature descriptions against implementation, flag spec-vs-reality gaps
- `api-specification.md` — verify rate limit categories, pagination defaults, session constants, error codes

**`docs/`:**
- `database-schema.md` — compare ER diagrams against current Drizzle schema
- `api-limits.md` — grep limit constants in codebase and verify doc matches
- `roadmap.md` — regenerate via `pnpm roadmap`
- `work-tracking.md` — quick accuracy check

**`docs/guides/` and `docs/api/`:**
- `webhook-signature-verification.md` — verify against current HMAC implementation
- `friend-export.md` — verify against current endpoint implementation

**`docs/adr/`:**
- Scan all 30 ADRs for broken cross-references and incorrect status fields (metadata fixes only, not rewriting content)

**`docs/security/`:**
- `threat-model.md` — add M5-M7 findings, update mitigation statuses

**Package docs:**
- `packages/crypto/docs/mobile-key-lifecycle.md` — verify against current crypto adapter API
- `packages/db/docs/dialect-api-guide.md`, `dialect-capabilities.md` — verify against current Drizzle schema
- `packages/sync/docs/*` (6 docs) — verify protocol messages, document topology, conflict resolution against current sync implementation

### Documents to Create

- `docs/guides/api-consumer-guide.md` — comprehensive API consumer guide

### Excluded

- `security/` (root directory) — point-in-time security audit artifacts
- `docs/local-audits/*` — gitignored working documents
- `docs/audits/*` — point-in-time audit reports

## API Consumer Guide Structure

Primary audience: ourselves and AI agents building the Expo app, secondary audience: external contributors building against the API.

### 1. Overview
- What the API is (Hono on Bun, REST + tRPC internal), zero-knowledge architecture, what "the server never sees plaintext" means for a client developer

### 2. Authentication
- Registration flow (account creation, key derivation, identity keypair generation, recovery key backup)
- Login flow (credential exchange, session token lifecycle, token hashing)
- Session management (idle timeout, absolute timeout, concurrent sessions, biometric token enrollment)
- Password reset via recovery key (not email-based)
- Device transfer flow (code generation, entropy model per ADR 024, attempt limiting)

### 3. Encryption Lifecycle
- Key derivation from password (Argon2id parameters, master key to sub-keys)
- Identity keypair (X25519 for key exchange, Ed25519 for signing)
- Bucket key model (per-bucket symmetric keys, creation, distribution via asymmetric encryption)
- Encryption tiers (T1 account-only, T2 bucket-scoped/shareable, T3 plaintext server-side)
- Per-field encryption (which fields are encrypted, blob format, nonce handling)
- Key rotation participation (lazy rotation per ADR 014 — detect pending, claim items, re-encrypt, report completion)
- Recovery key storage and regeneration

### 4. REST Conventions
- Response envelope format (standardized post-audit)
- Pagination (cursor-based keyset, page size defaults/limits)
- Error format (error codes, HTTP status mapping, structured error bodies)
- Idempotency keys (supported endpoints, header format)
- ETag / conditional requests (304 support)
- Rate limiting (categories, headers, retry-after behavior)

### 5. CRUD Patterns
- Standard entity lifecycle (create, read, update, archive, restore, delete)
- Deletion semantics (409 HAS_DEPENDENTS, RESTRICT on FKs)
- Archival vs deletion
- Blob upload pipeline (presigned URL, upload, confirm, lifecycle)
- Polymorphic authorship (member, custom front, structure entity)

### 6. Sync Protocol
- Connection setup (WebSocket endpoint, auth handshake, subscription profiles)
- CRDT document model (Automerge, encrypted relay, document topology)
- Sync session lifecycle (open, subscribe, relay, close)
- Offline queue and replay (batched drain, causal ordering, confirmation before clearing local)
- Conflict resolution (post-merge validation, hierarchy cycle detection, sort-order repair)
- SSE notification stream (heartbeat, reconnect replay, idle timeout)

### 7. Webhooks
- Configuration CRUD, secret generation, event types
- HMAC signature verification (cross-reference to existing guide)
- Secret rotation, test/ping endpoint, optional payload encryption
- Event types and payload shapes

### 8. Domain-Specific Patterns
- Fronting (start/end, co-fronting, structure entity fronting, comments, analytics)
- Communication (channels, polymorphic senders, boards, notes, polls, acknowledgements)
- Privacy buckets (intersection logic, fail-closed visibility, content tagging)
- Friend network (friend codes, connection lifecycle, bucket assignment, dashboard)
- Push notifications (device tokens, notification config, per-friend preferences)

### 9. Self-Hosted Considerations
- Adapter differences (Resend vs SMTP, S3 vs filesystem, BullMQ vs SQLite queue)
- Pointers to ADR 012 for tier details

## Execution Order

1. **Gather current state** — run coverage, count E2E tests, grep limit constants, check schema tables
2. **Package docs** (crypto, db, sync) — update first since consumer guide references them
3. **ADR scan** — fix metadata and cross-references
4. **`docs/planning/`** — milestones, features, api-specification
5. **`docs/` reference docs** — database-schema, api-limits, work-tracking
6. **`docs/security/threat-model.md`** — add M5-M7 findings
7. **`docs/guides/` and `docs/api/`** — update existing guides
8. **API consumer guide** — write new doc referencing everything updated above
9. **`roadmap.md`** — regenerate last (reflects bean state)
10. **Root files** — README, CONTRIBUTING, CHANGELOG, VALUES, CODE_OF_CONDUCT, SECURITY
11. **Final consistency check** — verify cross-references between docs
