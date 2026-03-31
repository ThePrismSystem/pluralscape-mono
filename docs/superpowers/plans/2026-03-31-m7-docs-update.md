# M7 Comprehensive Documentation Update — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit and update all project documentation for accuracy, plus create a comprehensive API consumer guide for M8 client app work.

**Architecture:** Single-pass through all docs in dependency order — package docs first (referenced by other docs), then planning docs, reference docs, new API consumer guide, and finally root-level files that summarize project state. Each task reads the current doc, compares against codebase source of truth, and writes updates.

**Tech Stack:** Markdown, grep/glob for codebase verification, `pnpm roadmap` for roadmap regeneration.

**Important constraints:**
- Do NOT modify anything in the `security/` root directory (point-in-time audit artifacts)
- Do NOT modify anything in `docs/audits/` or `docs/local-audits/` (point-in-time reports)
- ADR updates are metadata-only (status fields, cross-references) — do NOT rewrite ADR content
- All commands run from monorepo root

---

## Task 1: Gather Current State

Collect facts from the codebase that multiple later tasks will need. Save results to `.tmp/docs-audit/` for reference.

**Files:**
- Create: `.tmp/docs-audit/coverage.txt`
- Create: `.tmp/docs-audit/e2e-count.txt`
- Create: `.tmp/docs-audit/limits.txt`
- Create: `.tmp/docs-audit/schema-tables.txt`
- Create: `.tmp/docs-audit/route-domains.txt`
- Create: `.tmp/docs-audit/adr-list.txt`

- [ ] **Step 1: Create output directory**

```bash
mkdir -p .tmp/docs-audit
```

- [ ] **Step 2: Capture coverage numbers**

```bash
pnpm test:coverage > .tmp/docs-audit/coverage-full.txt 2>&1
# Then extract the summary line
grep -A5 'Coverage report' .tmp/docs-audit/coverage-full.txt > .tmp/docs-audit/coverage.txt 2>/dev/null || tail -20 .tmp/docs-audit/coverage-full.txt > .tmp/docs-audit/coverage.txt
```

Note: Coverage run is expensive. If it has been run recently and `.tmp/` has output, reuse it.

- [ ] **Step 3: Count E2E tests**

```bash
# Count spec files
find apps/api-e2e/src -name '*.spec.ts' -o -name '*.test.ts' | wc -l > .tmp/docs-audit/e2e-file-count.txt
# Count individual test cases
grep -r 'test(' apps/api-e2e/src --include='*.ts' | wc -l > .tmp/docs-audit/e2e-test-count.txt
# Also count by running the suite in dry-run/list mode if available
pnpm test:e2e --list > .tmp/docs-audit/e2e-list.txt 2>&1 || echo "list mode not available" > .tmp/docs-audit/e2e-list.txt
```

- [ ] **Step 4: Grep limit constants from codebase**

```bash
# Rate limit constants
grep -rn 'MAX_\|LIMIT_\|QUOTA_\|PAGE_SIZE\|MAX_PAGE' apps/api/src packages/*/src --include='*.ts' | grep -v node_modules | grep -v '.test.' | grep -v '__tests__' > .tmp/docs-audit/limits.txt
```

- [ ] **Step 5: List current schema tables**

```bash
# Get all table definitions from Drizzle schema
grep -rn 'pgTable\|sqliteTable' packages/db/src --include='*.ts' | grep -v node_modules | grep -v '.test.' > .tmp/docs-audit/schema-tables.txt
```

- [ ] **Step 6: List route domains and ADRs**

```bash
ls apps/api/src/routes/ > .tmp/docs-audit/route-domains.txt
ls docs/adr/*.md | grep -v template > .tmp/docs-audit/adr-list.txt
```

- [ ] **Step 7: Capture current E2E test domains**

```bash
ls apps/api-e2e/src/ > .tmp/docs-audit/e2e-domains.txt 2>/dev/null || find apps/api-e2e/src -maxdepth 2 -name '*.spec.ts' -o -name '*.test.ts' | sort > .tmp/docs-audit/e2e-domains.txt
```

---

## Task 2: Update Package Docs — Crypto

**Files:**
- Modify: `packages/crypto/docs/mobile-key-lifecycle.md`

- [ ] **Step 1: Read the current doc**

Read `packages/crypto/docs/mobile-key-lifecycle.md` in full.

- [ ] **Step 2: Read the current crypto adapter API**

Read the following files to understand current state:
- `packages/crypto/src/adapter/` — list files, read the adapter interface
- `packages/crypto/src/master-key.ts` — key derivation
- `packages/crypto/src/identity.ts` — identity keypair
- `packages/crypto/src/bucket-keys.ts` — bucket key management
- `packages/crypto/src/key-lifecycle.ts` — key rotation types
- `packages/crypto/src/device-transfer.ts` — device transfer crypto

- [ ] **Step 3: Compare doc against source and update**

Check for:
- Function names that have changed
- New adapter methods not documented
- Lifecycle steps that have been added or reordered
- Constants (key sizes, algorithm names) that have changed

Update the doc to match current code. Preserve the doc's existing structure and voice.

- [ ] **Step 4: Commit**

```bash
git add packages/crypto/docs/mobile-key-lifecycle.md
git commit -m "docs(crypto): update mobile key lifecycle to match current API"
```

If no changes were needed, skip the commit and note "no changes needed" in the step.

---

## Task 3: Update Package Docs — Database

**Files:**
- Modify: `packages/db/docs/dialect-api-guide.md`
- Modify: `packages/db/docs/dialect-capabilities.md`

- [ ] **Step 1: Read both docs**

Read `packages/db/docs/dialect-api-guide.md` and `packages/db/docs/dialect-capabilities.md` in full.

- [ ] **Step 2: Read current dialect implementation**

- `packages/db/src/` — list files to understand structure
- Find the dialect abstraction layer (likely `packages/db/src/dialects/` or similar)
- Read the PG and SQLite dialect files
- Check for any new capabilities added since the docs were written

- [ ] **Step 3: Compare and update both docs**

Check for:
- New tables not mentioned in the capabilities doc
- Changed dialect API methods
- New capabilities or removed limitations
- Schema changes from audit remediation work

Update both docs to match current code.

- [ ] **Step 4: Commit**

```bash
git add packages/db/docs/dialect-api-guide.md packages/db/docs/dialect-capabilities.md
git commit -m "docs(db): update dialect docs to match current schema and API"
```

---

## Task 4: Update Package Docs — Sync

**Files:**
- Modify: `packages/sync/docs/protocol-messages.md`
- Modify: `packages/sync/docs/document-topology.md`
- Modify: `packages/sync/docs/document-lifecycle.md`
- Modify: `packages/sync/docs/conflict-resolution.md`
- Modify: `packages/sync/docs/partial-replication.md`
- Modify: `packages/sync/docs/encrypted-relay-poc-report.md`

- [ ] **Step 1: Read all 6 sync docs**

Read each doc. They are 219–506 lines each, so read with offset/limit as needed.

- [ ] **Step 2: Read current sync implementation**

Key files to check:
- `packages/sync/src/protocol.ts` — message types
- `packages/sync/src/document-types.ts` — document type registry
- `packages/sync/src/engine/` — sync engine implementation
- `packages/sync/src/encrypted-sync.ts` — encryption layer
- `packages/sync/src/post-merge-validator.ts` — conflict resolution
- `packages/sync/src/offline-queue-manager.ts` — offline queue
- `packages/sync/src/projections/` — sync projections
- `packages/sync/src/factories/` — document factories (check for new document types added in M4-M7)
- `packages/sync/src/relay-service.ts` — relay implementation

- [ ] **Step 3: Compare and update all docs**

Check for:
- New message types in protocol not in the protocol-messages doc
- New document types added for M4-M7 features (fronting, communication, privacy, webhooks) not in document-topology
- Conflict resolution rules that have been added or changed
- Lifecycle states that have changed
- Partial replication subscription profiles that have been added
- The encrypted-relay-poc-report is likely a historical document — verify it's still accurate but don't expect it to need heavy updates

Update each doc to match current code.

- [ ] **Step 4: Commit**

```bash
git add packages/sync/docs/*.md
git commit -m "docs(sync): update sync protocol docs to match current implementation"
```

---

## Task 5: ADR Metadata Scan

**Files:**
- Modify: `docs/adr/*.md` (only those with incorrect metadata)

- [ ] **Step 1: Scan all ADRs for status fields**

```bash
grep -l '^Status:' docs/adr/*.md
# Also check for the status in YAML frontmatter or markdown header
head -10 docs/adr/0{01..30}*.md 2>/dev/null
```

Read the first 10 lines of each ADR to check the status field.

- [ ] **Step 2: Check cross-references**

For each ADR, grep for references to other ADRs and verify those referenced ADRs exist:

```bash
grep -n 'ADR [0-9]' docs/adr/*.md | head -50
grep -n '\[ADR' docs/adr/*.md | head -50
```

- [ ] **Step 3: Fix any incorrect statuses or broken references**

Common issues to look for:
- ADRs that reference non-existent ADR numbers
- ADRs that should reference newer ADRs (e.g., ADR 006 should mention ADR 014 for key rotation)
- Status fields that don't match reality (e.g., "Proposed" when work is complete)
- Broken relative links between ADR files

Fix only metadata and cross-references — do NOT rewrite ADR content.

- [ ] **Step 4: Commit (if any changes)**

```bash
git add docs/adr/*.md
git commit -m "docs(adr): fix metadata and cross-references across ADRs"
```

---

## Task 6: Update Planning Docs — Milestones

**Files:**
- Modify: `docs/planning/milestones.md`

- [ ] **Step 1: Read the current milestones doc**

Read `docs/planning/milestones.md` in full (248 lines).

- [ ] **Step 2: Check M7 epic completion status**

Cross-reference each M7 epic against:
- Recent git history: `git log --oneline --since="2026-03-01" | head -60`
- Bean status: `beans list --json -s completed | jq '[.[] | select(.title | test("email|webhook|audit|feature|portability"; "i"))] | .[0:20] | .[] | "\(.id) \(.title)"' -r`

Determine which M7 epics are now completed vs still in progress.

- [ ] **Step 3: Check M8 epic list against current beans**

```bash
beans list --json | jq '[.[] | select(.title | test("milestone 8|client|M8"; "i")) ] | .[] | "\(.id) \(.status) \(.title)"' -r
beans list --json --ready | jq '[.[] | select(.id | startswith("client-") or startswith("mobile-"))] | .[] | "\(.id) \(.title)"' -r
```

Verify the M8 epic list in milestones.md matches what's tracked in beans.

- [ ] **Step 4: Update milestones.md**

- Mark completed M7 epics with ~~strikethrough~~ and [COMPLETED] suffix (matching the pattern used for M1-M6)
- Update M7 status from `[IN PROGRESS]` if all epics are done
- Verify M8 epic list is current — add any missing epics, remove any that have been rescoped
- Update the ADR count if new ADRs have been added (currently says "30 accepted ADRs")

- [ ] **Step 5: Commit**

```bash
git add docs/planning/milestones.md
git commit -m "docs(planning): update milestone status for M7 completion"
```

---

## Task 7: Update Planning Docs — Features

**Files:**
- Modify: `docs/planning/features.md`

- [ ] **Step 1: Read the full features doc**

Read `docs/planning/features.md` (307 lines). Use offset/limit to read in chunks.

- [ ] **Step 2: Cross-check against implementation**

For each feature section, verify against the actual API routes and services:
- Section 1 (Identity): check `apps/api/src/routes/members/`, `groups/`, `custom-fronts/`, `structure/`
- Section 2 (Fronting): check `apps/api/src/routes/fronting-sessions/`, `analytics/`, `timer-configs/`, `check-in-records/`
- Section 3 (Communication): check `apps/api/src/routes/messages/`, `channels/`, `board-messages/`, `notes/`, `polls/`, `acknowledgements/`
- Section 4 (Privacy): check `apps/api/src/routes/buckets/`, `fields/`
- Section 5 (Social): check `apps/api/src/routes/` for friend-related routes, `notification-configs/`, `device-tokens/`
- Sections 6-9 (Integration, Journaling, Search, API): check for any API routes or types that implement these
- Section 10 (Import/Export): verify scope is still accurate for M8

Focus on features that were specced but may have been built differently, or features that were added during implementation that aren't in the spec.

- [ ] **Step 3: Update features.md**

Fix any spec-vs-reality gaps. Add notes where implementation differs from spec. Do NOT add features that are M8+ work — only update descriptions of features that have been built.

- [ ] **Step 4: Commit**

```bash
git add docs/planning/features.md
git commit -m "docs(planning): update feature spec to match implementation"
```

---

## Task 8: Update Planning Docs — API Specification

**Files:**
- Modify: `docs/planning/api-specification.md`

- [ ] **Step 1: Read the current api-specification doc**

Read `docs/planning/api-specification.md` (280 lines). Use offset/limit.

- [ ] **Step 2: Verify constants against codebase**

Cross-reference the doc's constants against the `.tmp/docs-audit/limits.txt` file from Task 1, plus:
- Rate limit categories: grep for rate limit middleware config in `apps/api/src/`
- Session constants: grep for session timeout/duration constants
- Pagination defaults: grep for page size constants
- Error codes: grep for error code enums/constants

```bash
grep -rn 'RATE_LIMIT\|rateLimitConfig\|rateLimit' apps/api/src --include='*.ts' | grep -v node_modules | grep -v '.test.' | head -20
grep -rn 'SESSION_\|IDLE_TIMEOUT\|ABSOLUTE_TIMEOUT' apps/api/src packages/*/src --include='*.ts' | grep -v node_modules | grep -v '.test.' | head -20
grep -rn 'ERROR_CODES\|ErrorCode\|errorCode' apps/api/src packages/*/src --include='*.ts' | grep -v node_modules | grep -v '.test.' | head -20
```

- [ ] **Step 3: Update api-specification.md**

Fix any constants that have changed. Add any new operational constants that emerged from M7 work (e.g., new rate limit categories, new error codes for feature completeness endpoints).

- [ ] **Step 4: Commit**

```bash
git add docs/planning/api-specification.md
git commit -m "docs(planning): update API specification constants to match codebase"
```

---

## Task 9: Update Reference Docs — Database Schema

**Files:**
- Modify: `docs/database-schema.md`

- [ ] **Step 1: Read the current database-schema doc**

Read `docs/database-schema.md` (1163 lines). Read in chunks using offset/limit.

- [ ] **Step 2: Compare against current Drizzle schema**

Use `.tmp/docs-audit/schema-tables.txt` from Task 1. Also:

```bash
# List all schema files
find packages/db/src -name '*.schema.ts' -o -name '*.table.ts' | sort
# Or find the schema directory
ls packages/db/src/schema/ 2>/dev/null || ls packages/db/src/tables/ 2>/dev/null || find packages/db/src -name '*schema*' -type f | head -20
```

For each table in the schema, verify it appears in the database-schema doc with correct columns and relationships.

- [ ] **Step 3: Update database-schema.md**

Focus on:
- New tables added in M4-M7 (fronting comments, webhook configs, webhook deliveries, email-related columns, API keys, notification configs, device tokens, acknowledgements, polls, board messages, notes, channels, channel categories)
- Modified tables (new columns added during audit remediation)
- Updated ER diagram relationships

This is the largest doc update. Work through it domain by domain, matching the doc's existing section structure.

- [ ] **Step 4: Commit**

```bash
git add docs/database-schema.md
git commit -m "docs(db): update database schema diagrams to match current tables"
```

---

## Task 10: Update Reference Docs — API Limits

**Files:**
- Modify: `docs/api-limits.md`

- [ ] **Step 1: Read the current api-limits doc**

Read `docs/api-limits.md` (68 lines).

- [ ] **Step 2: Verify against codebase constants**

Use `.tmp/docs-audit/limits.txt` from Task 1. Additionally:

```bash
grep -rn 'MAX_\|_LIMIT\|_QUOTA' apps/api/src packages/*/src --include='*.constants.ts' | grep -v node_modules
```

Check for:
- Rate limit values per category (read, write, auth, sensitive)
- Pagination limits
- Blob storage limits
- Entity count limits (custom fields, nesting depth, etc.)
- Any new limits added during M4-M7 (message limits, channel limits, poll limits, etc.)

- [ ] **Step 3: Update api-limits.md**

Add any missing limits. Fix any changed values. Organize by domain if the doc has grown significantly.

- [ ] **Step 4: Commit**

```bash
git add docs/api-limits.md
git commit -m "docs: update API limits to match current constants"
```

---

## Task 11: Update Reference Doc — Work Tracking

**Files:**
- Modify: `docs/work-tracking.md`

- [ ] **Step 1: Read and verify**

Read `docs/work-tracking.md` (121 lines). Verify beans conventions match current practice — check against `CLAUDE.md` beans section and actual bean files in `.beans/`.

- [ ] **Step 2: Update if needed**

Fix any stale conventions. If the doc is accurate, skip this commit.

- [ ] **Step 3: Commit (if changed)**

```bash
git add docs/work-tracking.md
git commit -m "docs: update work tracking conventions"
```

---

## Task 12: Update Threat Model

**Files:**
- Modify: `docs/security/threat-model.md`

- [ ] **Step 1: Read the current threat model**

Read `docs/security/threat-model.md` (201 lines).

- [ ] **Step 2: Identify M5-M7 security-relevant changes**

Review the CHANGELOG and recent audit findings:
- M5 (Communication): proxy messaging security, channel access control
- M6 (Privacy and Social): privacy bucket intersection logic, friend network access control, device token takeover prevention, fail-closed visibility
- M7 (Data Portability): email encryption (ADR 029), webhook HMAC security, secret rotation, anti-enumeration timing, ownership consolidation

Also check:
- `docs/local-audits/014-m3-security-audit.md` — for any findings that should be in the threat model
- `docs/local-audits/015-api-security-audit-2026-03-30.md` — most recent security audit findings

- [ ] **Step 3: Add M5-M7 sections to threat model**

Add new sections following the existing doc's pattern (Finding → Current state → Defense-in-depth → Deployment requirements/Mitigations). Cover:
- Communication security (M5) — proxy messaging trust model, channel access
- Privacy engine security (M6) — bucket intersection, fail-closed, device token security
- Email encryption (M7) — server-side AES-256-GCM, BLAKE2b hash preservation
- Webhook security (M7) — HMAC signing, secret rotation, payload encryption
- Auth hardening (M7) — anti-enumeration timing, session idle filter improvements

Update mitigation statuses for any existing findings that have been addressed.

- [ ] **Step 4: Commit**

```bash
git add docs/security/threat-model.md
git commit -m "docs(security): add M5-M7 findings to threat model"
```

---

## Task 13: Update Existing Guides

**Files:**
- Modify: `docs/guides/webhook-signature-verification.md`
- Modify: `docs/api/friend-export.md`

- [ ] **Step 1: Read both docs**

Read `docs/guides/webhook-signature-verification.md` (232 lines) and `docs/api/friend-export.md` (88 lines).

- [ ] **Step 2: Verify webhook guide against implementation**

Check the current webhook HMAC implementation:

```bash
grep -rn 'hmac\|HMAC\|signature\|webhook.*secret' apps/api/src/routes/webhooks/ apps/api/src/services/webhook* --include='*.ts' | head -20
```

Verify:
- Algorithm (HMAC-SHA256)
- Header name for signature
- Secret rotation flow matches what the guide describes
- Code examples in the guide use the correct header/algorithm

- [ ] **Step 3: Verify friend export guide against implementation**

```bash
grep -rn 'export\|manifest' apps/api/src/routes/friends/ apps/api/src/services/friend* --include='*.ts' | head -20
```

Check that the endpoint paths, query parameters, and response shapes match.

- [ ] **Step 4: Update both docs as needed**

- [ ] **Step 5: Commit (if changed)**

```bash
git add docs/guides/webhook-signature-verification.md docs/api/friend-export.md
git commit -m "docs: update webhook and friend export guides to match implementation"
```

---

## Task 14: Write API Consumer Guide — Sections 1-3

**Files:**
- Create: `docs/guides/api-consumer-guide.md`

This is the largest new document. Split across Tasks 14-17 for manageability.

- [ ] **Step 1: Gather auth and encryption implementation details**

Read the following to extract accurate details:
- `apps/api/src/routes/auth/` — auth endpoints
- `apps/api/src/services/auth*` — auth service logic
- `packages/crypto/src/master-key.ts` — key derivation parameters
- `packages/crypto/src/identity.ts` — identity keypair generation
- `packages/crypto/src/bucket-keys.ts` — bucket key model
- `packages/crypto/src/crypto.constants.ts` — algorithm constants, key sizes
- `packages/crypto/src/key-lifecycle.ts` — rotation types
- `packages/crypto/src/device-transfer.ts` — device transfer protocol
- `packages/crypto/src/password.ts` — password hashing
- `apps/api/src/routes/account/` — account management (PIN, deletion)
- ADR 006, ADR 013, ADR 014, ADR 024 — for architectural context

- [ ] **Step 2: Write Section 1 — Overview**

Cover:
- What the API is (Hono on Bun, REST, zero-knowledge)
- Base URL conventions
- What "zero-knowledge" means practically — the server stores ciphertext, never sees plaintext. The client is responsible for all encryption/decryption
- Link to OpenAPI spec at `docs/openapi.yaml`
- Encryption tier summary (T1/T2/T3) with brief explanation

- [ ] **Step 3: Write Section 2 — Authentication**

Cover with exact endpoint paths and request/response shapes:
- Registration: `POST /v1/auth/register` — account creation with encrypted key material
- Login: `POST /v1/auth/login` — credential exchange, session token format
- Session management: idle timeout, absolute timeout, concurrent sessions
- Biometric token enrollment
- Password reset via recovery key (explain why no email-based reset)
- Device transfer flow: code generation → code entry → key exchange → confirmation

- [ ] **Step 4: Write Section 3 — Encryption Lifecycle**

This is the most detailed section. Cover:
- Key derivation: Argon2id parameters → master key → sub-key derivation (encryption key, auth key, identity seed)
- Identity keypair: X25519 for key exchange, Ed25519 for signing, how they're generated from the identity seed
- Bucket key model: what a bucket is, per-bucket symmetric key generation, how bucket keys are distributed to friends via X25519 key exchange
- Encryption tiers: T1 (account key, never shared), T2 (bucket key, shared with friends who have bucket access), T3 (plaintext, server-side only — e.g., webhook secrets)
- Per-field encryption: which entity fields are encrypted (reference the schema doc), XChaCha20-Poly1305 AEAD format, nonce handling (random per-encryption)
- Key rotation: lazy rotation model (ADR 014) — server tracks rotation state, client detects pending rotation via response headers or dedicated endpoint, claims items in chunks, re-encrypts with new key, reports completion
- Recovery key: generated at registration, stored by user, used for password reset. How it wraps the master key

- [ ] **Step 5: Save progress**

Write the file with sections 1-3 complete. Do NOT commit yet — will commit the full guide in Task 17.

---

## Task 15: Write API Consumer Guide — Sections 4-5

**Files:**
- Modify: `docs/guides/api-consumer-guide.md`

- [ ] **Step 1: Gather REST convention details**

Read the following:
- `apps/api/src/middleware/` — error handler, rate limiter, pagination, idempotency
- Response envelope format (grep for `envelope` or `ApiResponse` or `wrapResponse`)
- Error code enum/constants
- Rate limit header constants
- Pagination cursor implementation

```bash
grep -rn 'envelope\|ApiResponse\|wrapResponse\|apiResponse' apps/api/src --include='*.ts' | grep -v node_modules | grep -v '.test.' | head -15
grep -rn 'idempotency\|Idempotency' apps/api/src --include='*.ts' | grep -v node_modules | grep -v '.test.' | head -10
grep -rn 'ETag\|etag\|If-None-Match' apps/api/src --include='*.ts' | grep -v node_modules | grep -v '.test.' | head -10
```

- [ ] **Step 2: Write Section 4 — REST Conventions**

Cover:
- Response envelope: `{ data, meta?, pagination? }` (or whatever the current format is — verify from code)
- Pagination: cursor-based keyset pagination, `cursor` and `limit` query params, page size defaults/limits, `nextCursor` in response
- Error responses: `{ error: { code, message, details? } }` format, HTTP status mapping, common error codes table
- Idempotency: `Idempotency-Key` header, which endpoints support it, TTL, replay behavior
- ETag / conditional requests: `ETag` response header, `If-None-Match` request header, 304 behavior
- Rate limiting: categories (read/write/auth/sensitive), `X-RateLimit-*` headers, `Retry-After` header, 429 behavior

- [ ] **Step 3: Write Section 5 — CRUD Patterns**

Cover:
- Standard entity lifecycle: create → read → list → update → archive → restore → delete
- URL patterns: `POST /v1/{resource}`, `GET /v1/{resource}/:id`, `PATCH /v1/{resource}/:id`, `POST /v1/{resource}/:id/archive`, etc.
- Deletion semantics: 409 `HAS_DEPENDENTS` when entity has dependent children, `onDelete: "restrict"` pattern. Archival is always allowed. Permanent deletion requires no dependents (or cascades for system/account purge)
- Blob upload pipeline: `POST /v1/blobs/upload-url` → presigned URL → `PUT` to S3 → `POST /v1/blobs/:id/confirm` → blob ready for use. TTL on presigned URLs. Orphan cleanup for unconfirmed blobs
- Polymorphic authorship: some entities (messages, board messages, notes, poll votes) support multiple sender types — member, custom front, or structure entity. The `authorType` + `authorId` pattern

- [ ] **Step 4: Save progress**

Append sections 4-5 to the guide file.

---

## Task 16: Write API Consumer Guide — Sections 6-7

**Files:**
- Modify: `docs/guides/api-consumer-guide.md`

- [ ] **Step 1: Gather sync and webhook details**

Read:
- `apps/api/src/routes/sync/` or wherever the WebSocket endpoint is
- `packages/sync/src/protocol.ts` — message types
- `packages/sync/src/document-types.ts` — document type registry
- `packages/sync/src/offline-queue-manager.ts` — offline queue
- `apps/api/src/routes/notifications/` — SSE endpoint
- `apps/api/src/routes/webhooks/` — webhook CRUD
- `apps/api/src/services/webhook*` — webhook delivery

- [ ] **Step 2: Write Section 6 — Sync Protocol**

Cover:
- WebSocket connection: endpoint URL, auth handshake (token in first message or header), connection lifecycle
- Subscription profiles: what they are, how to subscribe to specific document types
- CRDT document model: Automerge documents, encrypted relay (client sends encrypted Automerge binary, server relays without reading), document type → sync strategy mapping
- Sync session lifecycle: open connection → authenticate → subscribe to documents → receive/send sync messages → close
- Offline queue: how the client queues changes while offline, batched drain on reconnect, causal ordering guarantees, confirmation before clearing local queue
- Conflict resolution: post-merge validation (server validates merged state), hierarchy cycle detection, sort-order repair — what happens when conflicts occur and how the client should handle rejection
- SSE notification stream: endpoint URL, heartbeat interval, reconnect replay (missed events replayed on reconnect), idle timeout, event types

- [ ] **Step 3: Write Section 7 — Webhooks**

Cover:
- Webhook config CRUD: create/update/delete webhook configs, event type selection, URL validation
- Secret generation: HMAC secret auto-generated on creation, returned once
- HMAC signature verification: `X-Webhook-Signature` header, HMAC-SHA256, cross-reference to `docs/guides/webhook-signature-verification.md` for detailed examples
- Secret rotation: `POST /v1/webhooks/:id/rotate-secret`, old secret valid during grace period
- Test/ping: `POST /v1/webhooks/:id/test`, sends a ping event to verify endpoint
- Optional payload encryption: when an API key is configured, webhook payloads can be encrypted
- Event types and payload shapes: table of all supported event types with brief description of when they fire

- [ ] **Step 4: Save progress**

Append sections 6-7 to the guide file.

---

## Task 17: Write API Consumer Guide — Sections 8-9 and Finalize

**Files:**
- Modify: `docs/guides/api-consumer-guide.md`

- [ ] **Step 1: Gather domain-specific patterns**

Read key route files for each domain:
- Fronting: `apps/api/src/routes/fronting-sessions/`
- Communication: `apps/api/src/routes/messages/`, `channels/`, `board-messages/`, `notes/`, `polls/`, `acknowledgements/`
- Privacy: `apps/api/src/routes/buckets/`
- Friends: grep for friend-related routes
- Push: `apps/api/src/routes/device-tokens/`, `notification-configs/`

- [ ] **Step 2: Write Section 8 — Domain-Specific Patterns**

Cover each domain concisely — endpoint patterns, key concepts, and gotchas:
- **Fronting:** start/end fronting session, co-fronting (multiple concurrent sessions with overlapping time ranges), structure entity fronting, fronting comments, analytics query endpoints (duration, percentage, date range presets)
- **Communication:** channel/category hierarchy, proxy messaging (member sends as themselves within the system), polymorphic senders, board message reorder, poll lifecycle (create → vote → close), acknowledgement routing (create → target members → confirm/resolve)
- **Privacy buckets:** bucket CRUD, content tagging (21 entity types), intersection logic for friend visibility (friend sees content only if they have ALL required buckets), fail-closed default (unmapped/errored → invisible), field-level bucket visibility
- **Friend network:** friend code generation (`XXXX-XXXX` format), code redemption → pending → accept/reject/block, bucket assignment per friend, dashboard endpoint (read-only view filtered by bucket visibility), friend data export with cursor pagination
- **Push notifications:** device token registration with ownership validation, notification config per device, per-friend notification preferences, push worker sends on switch events

- [ ] **Step 3: Write Section 9 — Self-Hosted Considerations**

Brief section covering:
- Adapter pattern: the API uses adapters for external services. A client shouldn't care which adapter is active, but behavior may differ slightly
- Email: Resend (hosted) vs SMTP/Nodemailer (self-hosted) — affects email delivery speed and formatting
- Blob storage: S3 (hosted) vs filesystem (self-hosted) — presigned URL format differs
- Job queue: BullMQ/Valkey (hosted) vs SQLite queue (self-hosted) — affects async job timing
- Pointer to ADR 012 for full tier comparison

- [ ] **Step 4: Add table of contents and review full guide**

Add a table of contents at the top. Read through the full guide for consistency — verify all cross-references to other docs are correct, endpoint paths are consistent, and terminology matches the project glossary.

- [ ] **Step 5: Commit the full guide**

```bash
git add docs/guides/api-consumer-guide.md
git commit -m "docs(guides): add comprehensive API consumer guide for M8 client work"
```

---

## Task 18: Regenerate Roadmap

**Files:**
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Regenerate roadmap**

```bash
pnpm roadmap
```

- [ ] **Step 2: Verify output**

Read `docs/roadmap.md` and verify it reflects current bean state.

- [ ] **Step 3: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs: regenerate roadmap from current beans"
```

---

## Task 19: Update Root Files — README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read current README**

Read `README.md` (213 lines).

- [ ] **Step 2: Update status section**

Using data from `.tmp/docs-audit/coverage.txt` and `.tmp/docs-audit/e2e-count.txt`:
- Update milestone status (M7 completion state)
- Update the M7 description to reflect what was actually built
- Update coverage table with current numbers
- Update E2E test count and spec file count
- Update list of what E2E tests cover (should now include M4-M7 features)

- [ ] **Step 3: Verify rest of README**

Check:
- Values section still accurate
- Architecture section still accurate
- License section still accurate
- Any links to other docs still valid

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: update README with current project status and coverage"
```

---

## Task 20: Update Root Files — CONTRIBUTING, CHANGELOG, Others

**Files:**
- Modify: `CONTRIBUTING.md`
- Modify: `CHANGELOG.md`
- Read-only verify: `VALUES.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`

- [ ] **Step 1: Read and update CONTRIBUTING.md**

Read `CONTRIBUTING.md` (160 lines). Verify:
- Dev setup prerequisites — does it mention Bun, pnpm, Docker, Node version?
- Test commands — do they match `CLAUDE.md` and `package.json` scripts?
- TDD section — does it match current practice?
- ADR count — update if more than 30 now
- Any other conventions that have changed

- [ ] **Step 2: Verify CHANGELOG completeness**

Read `CHANGELOG.md` (239 lines). Check the `[Unreleased] — Milestone 7` section against:
- Recent git history: `git log --oneline --since="2026-03-15" | head -40`
- Compare against milestones.md M7 epics

Add any missing M7 entries. Key items to verify are present:
- Email notification system
- Webhook enhancements (secret rotation, test/ping, payload encryption)
- Webhook event dispatch
- API feature completeness (30+ endpoints)
- M7 audit remediation
- OpenAPI spec reconciliation
- E2E test coverage expansion
- API consistency normalization
- API code quality audit remediation

- [ ] **Step 3: Verify VALUES.md, CODE_OF_CONDUCT.md, SECURITY.md**

Read each file. Verify accuracy. These are likely stable and won't need changes.

For `SECURITY.md` specifically: verify the security disclosure contact info and process are current.

- [ ] **Step 4: Commit changes**

```bash
git add CONTRIBUTING.md CHANGELOG.md VALUES.md CODE_OF_CONDUCT.md SECURITY.md
git commit -m "docs: update CONTRIBUTING, CHANGELOG, and root docs for M7"
```

Only include files that actually changed.

---

## Task 21: Final Consistency Check

**Files:**
- Potentially any doc modified in earlier tasks

- [ ] **Step 1: Check cross-references**

```bash
# Find all markdown links and verify targets exist
grep -rn '\[.*\](.*\.md)' docs/ README.md CONTRIBUTING.md --include='*.md' | grep -v node_modules | head -60
```

For each link target, verify the file exists. Fix any broken links.

- [ ] **Step 2: Check terminology consistency**

Verify project terminology is used consistently across all updated docs:
- "system" not "patient"
- "member" not "alter"/"personality"
- "fronting" not "presenting"
- "switch" not "transition"
- "plural" not "disordered"

```bash
grep -rn '\bpatient\b\|"alter"\|\balter\b\|\bpersonality\b\|\bpresenting\b\|\btransition\b\|\bdisordered\b' docs/ README.md CONTRIBUTING.md --include='*.md' | grep -v node_modules | grep -v CHANGELOG | head -20
```

Note: Some of these terms may appear in legitimate contexts (e.g., "alter" as a community synonym is acceptable per CLAUDE.md). Only fix clinical/pathologizing usage.

- [ ] **Step 3: Verify no excluded files were modified**

```bash
git diff --name-only HEAD~20 | grep -E '^security/|^docs/audits/|^docs/local-audits/' || echo "No excluded files modified"
```

- [ ] **Step 4: Final commit (if any fixes)**

```bash
git add -A docs/ README.md CONTRIBUTING.md
git commit -m "docs: fix cross-references and terminology consistency"
```

Only commit if there were actual fixes.
