# Audit 012: Comprehensive API Audit

**Date**: 2026-03-18
**Scope**: `apps/api/src/` — all routes, services, middleware, and supporting libraries
**Test suite**: 264 test files, 3872 tests, all passing (monorepo-wide); 107 files, 1107 tests (API project)
**Purpose**: Pre-M3 comprehensive audit ensuring the API layer is airtight before moving forward
**Sources**: Parallel agent-based audit (6 agents) + independent Codex audit (cross-validated)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Bean Acceptance Criteria](#2-bean-acceptance-criteria)
3. [Feature Coverage (features.md)](#3-feature-coverage)
4. [Security and Runtime Correctness](#4-security-and-runtime-correctness)
5. [Performance and Best Practices](#5-performance-and-best-practices)
6. [Test Coverage](#6-test-coverage)
7. [Missing Endpoints](#7-missing-endpoints)
8. [Consolidated Findings by Severity](#8-consolidated-findings-by-severity)
9. [Recommended Actions](#9-recommended-actions)

---

## 1. Executive Summary

The M2 API layer covers all planned domains with full CRUD, auth, and audit logging. However, **two critical runtime defects** and **several high-impact contract violations** must be fixed before M3.

**Critical issues:**

- Blob storage adapter is never initialized at runtime — blob upload/download will throw in production
- Multi-system accounts are broken across most system-scoped routes due to in-memory ownership check

**High-impact gaps:**

- Member archival is destructive (permanently deletes field values)
- Member duplication is incomplete (`copyMemberships` is a no-op)
- Recovery-key password reset is missing from the auth API
- Valkey rate limiter wiring is broken (store captured before initialization)
- Session tokens stored unhashed and exposed via listing endpoint and audit logs
- Missing permanent delete endpoints for members, member photos, field definitions

**Positive:**

- 62/67 API beans fully satisfied; strong service-layer test coverage (100% of services)
- Consistent error handling, pagination, URL conventions, and audit logging
- Solid anti-timing protections, E2E encryption discipline, and parameterized queries throughout

Post-M2 features (fronting, messaging, privacy buckets, journals, etc.) have zero API coverage, which is expected per the milestone plan.

---

## 2. Bean Acceptance Criteria

**Result**: 62/67 beans fully met | 4 partially met | 1 not met

### NOT MET

| Bean     | Title                                    | Severity | Issue                                                                                                                                                                                                                                                                                                                                                  |
| -------- | ---------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| api-dwou | Lifecycle event type-specific validation | MEDIUM   | No per-event-type Zod schemas or server-side validation exist. All type-specific data is inside `encryptedData` (E2E encrypted), making server-side validation architecturally impossible without exposing plaintext reference fields. Needs a design decision: either add plaintext reference IDs or explicitly scope to client-side validation only. |

### PARTIALLY MET

| Bean     | Title                                        | Severity | Issue                                                                                                                                                                                                                                                                                                    |
| -------- | -------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| api-b0nb | Member CRUD                                  | HIGH     | No permanent member delete; archival destructively deletes field values; duplication's `copyMemberships` is a no-op despite being accepted by the schema.                                                                                                                                                |
| api-s07n | Audit log query endpoint                     | MEDIUM   | Missing the documented `resourceType` filter — only `event_type` is supported.                                                                                                                                                                                                                           |
| api-le53 | Per-category rate limiting                   | HIGH     | Valkey store wiring is broken — all rate limiters capture `sharedStore` at construction time (before `setRateLimitStore()` is called), so the Valkey store is never used. Additionally, category is not included in rate limit keys, so categories with the same window would collide in a shared store. |
| api-uixu | Download URL and blob lifecycle              | LOW      | S3 cleanup background job does not exist — archived blob objects remain in object storage indefinitely. Presigned download URL TTL not explicitly configured (uses storage adapter default).                                                                                                             |
| api-yp99 | Max length constraint on encryptedData       | LOW      | `UpdateSystemBodySchema` uses `MAX_ENCRYPTED_DATA_SIZE` (87 KiB) instead of the intended `MAX_ENCRYPTED_SYSTEM_DATA_SIZE` (128 KiB). More restrictive than intended — no security concern, but behavior doesn't match the bean description.                                                              |
| api-swt5 | AccountId in session revocation WHERE clause | LOW      | The TOCTOU fix is correctly applied (accountId is in the WHERE clause). The bean summary claims the pre-transaction check was removed, but it still exists (lines 342-346). The remaining check is an optimization, not a security issue.                                                                |

---

## 3. Feature Coverage

**Result**: 16 fully covered | 11 partially covered | 15 not covered

### Fully Covered (M2 scope)

System structure (subsystems, side systems, layers, relationships, cross-structure links, lifecycle events), innerworld (regions, entities, canvas), custom fronts, field definitions/values, groups (CRUD + move + reorder + tree + memberships), blob storage, auth/sessions (register, login, biometric, recovery key status/regenerate), account management, system settings, nomenclature, setup wizard, key rotation.

### Partially Covered

| Feature Area      | What's Missing                                                                                                                              | Severity  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Members           | No permanent DELETE endpoint; archival destroys field values; duplication incomplete (`copyMemberships` no-op)                              | HIGH      |
| Member photos     | No permanent DELETE endpoint                                                                                                                | HIGH      |
| Auth/recovery     | Recovery-key password reset missing — crypto primitives exist in `packages/crypto/src/password-reset.ts` but no API endpoint                | HIGH      |
| Groups/folders    | Folder copy/duplicate not implemented (move exists)                                                                                         | MEDIUM    |
| Audit log         | Endpoint exists but missing `resourceType` filter described in bean/spec                                                                    | MEDIUM    |
| Member display    | No member-centric membership endpoint — memberships only queryable from parent entity (groups, subsystems, etc.), forcing clients to do N+1 | MEDIUM    |
| Field definitions | No permanent DELETE endpoint                                                                                                                | MEDIUM    |
| Blobs             | No list endpoint (can get individual blobs but not enumerate)                                                                               | LOW       |
| Bucket management | Only key rotation sub-routes exist — no bucket CRUD                                                                                         | HIGH (M6) |
| Custom fields     | Capped at 200 despite "unlimited" feature wording — acceptable for MVP if documented                                                        | LOW       |
| Subsystem nesting | Capped at 50 depth despite "no hard depth limit" wording — acceptable if documented                                                         | LOW       |

### Not Covered (Post-M2 — Expected)

| Feature Area                            | Milestone | Severity     |
| --------------------------------------- | --------- | ------------ |
| Fronting sessions/switches/history      | M4        | Not in scope |
| Chat channels and messaging             | M5        | Not in scope |
| Board messages                          | M5        | Not in scope |
| Notes                                   | M5        | Not in scope |
| Polls/acknowledgements                  | M5        | Not in scope |
| Privacy bucket CRUD and content tagging | M6        | Not in scope |
| Friend connections/codes/key grants     | M6        | Not in scope |
| Device tokens/notifications             | M6        | Not in scope |
| API keys/webhooks                       | M7        | Not in scope |
| Import/export                           | M7        | Not in scope |
| Account purge                           | M7        | Not in scope |
| Journal entries                         | M8        | Not in scope |
| Wiki pages                              | M8        | Not in scope |
| System snapshots                        | Future    | Not in scope |
| Sync protocol                           | M3        | Not in scope |

---

## 4. Security and Runtime Correctness

**Result**: 2 critical | 2 high | 4 medium | 6 low | 15 positive findings

### CRITICAL

#### S-1: Blob Storage Adapter Never Initialized at Runtime

- **File**: `apps/api/src/lib/storage.ts:12-25`, `apps/api/src/index.ts`
- **Issue**: `getStorageAdapter()` requires `initStorageAdapter()` to be called at startup, but no call site exists in `index.ts` or anywhere else (`rg initStorageAdapter` only finds the definition). All blob routes (`upload-url`, `confirm`, `download-url`, `delete`) call `getStorageAdapter()` and will throw at runtime.
- **Recommendation**: Initialize the storage adapter in `index.ts` during `start()`, or fail fast at startup if storage is not configured.

#### S-2: Multi-System Ownership Broken Across Most System-Scoped Routes

- **File**: `apps/api/src/lib/session-auth.ts:25-35,63-66`, `apps/api/src/lib/assert-system-ownership.ts:8-10`
- **Issue**: `auth.systemId` is set from the FIRST system found via `leftJoin` in session validation. For accounts with multiple systems (supported via `POST /systems/`), the in-memory `assertSystemOwnership` will reject legitimate requests to non-primary systems. This helper is used by group, custom-front, lifecycle-event, blob, structure, and innerworld services — a large portion of the API.
- **Recommendation**: Remove the in-memory ownership helper for system routes. Use DB-backed ownership verification everywhere, or carry only `accountId` in auth context and verify system ownership per-request.

### HIGH

#### S-3: Valkey Rate Limiter Wiring Broken and Category Keys Collide

- **File**: `apps/api/src/middleware/rate-limit.ts:82-94`, `apps/api/src/index.ts:39,57-63`
- **Issue**: `createCategoryRateLimiter("global")` (line 39) and all per-route category rate limiters capture `sharedStore` at middleware construction time — before `setRateLimitStore()` is called during `start()` (line 60). The Valkey store is never actually used; all rate limiters silently fall back to in-memory stores. Additionally, rate limit keys use only the client IP (`getClientKey`), not the category, so if the shared store were working, categories with the same window duration would share the same counter.
- **Recommendation**: Resolve the store lazily at request time (not at construction), or set it before route middleware is constructed. Include category in the increment key.

#### S-4: Session Tokens Stored Unhashed, Returned by Listing, and Logged in Audit Details

- **Files**: `apps/api/src/lib/session-auth.ts:35`, `apps/api/src/services/auth.service.ts:283-333,366,395`
- **Issue**: The raw session bearer token IS the database `sessions.id` (not hashed). This same token is: (a) stored as the DB primary key, (b) returned in the `listSessions` response, and (c) written into audit log `detail` strings on revocation. A database compromise, audit log exposure, or API response interception leaks active bearer credentials.
- **Recommendation**: Store `BLAKE2b(token)` as the session ID. Return only opaque display-safe session identifiers (e.g., truncated hash). Redact or hash session references in audit logs.

### MEDIUM

#### S-5: Privacy Rule Inconsistency — 403 FORBIDDEN vs Fail-Closed 404 NOT_FOUND

- **File**: `apps/api/src/lib/assert-system-ownership.ts:8-10`
- **Issue**: The in-memory ownership check throws `403 FORBIDDEN` when the system doesn't match. The project's privacy principle is fail-closed (maximum restriction), which would mean returning `404 NOT_FOUND` to avoid leaking whether a resource exists. The DB-based `verifySystemOwnership` already returns 404. This is inconsistent.
- **Recommendation**: Align all ownership checks to return 404 for fail-closed privacy semantics, consistent with the DB-based approach.

#### S-6: Member Archival Destroys Field Values (Violates Preservation Contract)

- **File**: `apps/api/src/services/member.service.ts:437-446,482-500`
- **Issue**: `archiveMember` permanently deletes field values via `tx.delete(fieldValues)` and cascade-archives photos. On restore, photos are NOT auto-restored (by design comment), and deleted field values are unrecoverable. This violates the expected "read-only preservation with instant restore" archival contract.
- **Recommendation**: Change archive to preserve field values (set `archived: true` instead of deleting). If selective restoration is required, track archive provenance instead of deleting state.

#### S-7: Member Duplication Incomplete — `copyMemberships` Is a No-Op

- **File**: `apps/api/src/services/member.service.ts:328-393`, `packages/validation/src/member.ts:23`
- **Issue**: The `DuplicateMemberBodySchema` accepts `copyMemberships: boolean` but the service only copies photos and field values — membership copying is not implemented. Additionally, duplication does not record the discovery lifecycle event that the feature spec requires.
- **Recommendation**: Implement membership copying (group memberships, subsystem memberships, etc.) and record the lifecycle event.

#### S-8: Recovery-Key Password Reset Missing from Auth API

- **File**: `apps/api/src/routes/auth/recovery-key.ts`
- **Issue**: Only `GET /status` and `POST /regenerate` endpoints exist. Password reset via recovery key has crypto primitives in `packages/crypto/src/password-reset.ts` but no API endpoint. The recovery model is incomplete at the API layer.
- **Recommendation**: Add a dedicated unauthenticated `POST /auth/password-reset/recovery-key` endpoint and tests.

### LOW

| ID   | Finding                                                                                              | File                                                        |
| ---- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| S-9  | Session ID param not validated on `DELETE /auth/sessions/:id`                                        | `routes/auth/sessions.ts:46`                                |
| S-10 | Read endpoints rely only on global rate limit (100/min) — no per-category limit                      | Various GET routes                                          |
| S-11 | Audit log query endpoint has no specific rate limit                                                  | `routes/account/audit-log.ts`                               |
| S-12 | HSTS `preload` directive missing                                                                     | `middleware/secure-headers.ts:23`                           |
| S-13 | Two functionally identical ownership modules (`system-ownership.ts` vs `verify-system-ownership.ts`) | `lib/system-ownership.ts`, `lib/verify-system-ownership.ts` |
| S-14 | Request IDs are UUIDv4 (via `crypto.randomUUID()`) instead of UUIDv7 per API spec                    | `middleware/request-id.ts:9`                                |

### Positive Findings

- Auth middleware correctly applied to all routes that need it; unauthenticated routes (login, register, health) are intentionally open
- Anti-timing protection on login (dummy Argon2 hash), registration (fake success with delay), and PIN verification
- All DB queries use Drizzle ORM parameterization — no raw SQL or string concatenation found
- Email addresses stored as keyed BLAKE2b hashes (zero-knowledge lookup)
- Sensitive key material zeroed via `memzero()` in `try/finally` blocks across all crypto operations
- CORS defaults to no cross-origin when unset (safe default)
- Security headers comprehensive (CSP, X-Frame-Options, HSTS, X-Content-Type-Options)
- Zod validation on all endpoints; encrypted data size limits enforced
- Global + per-category rate limiting with proper headers (X-RateLimit-\*, Retry-After)
- Production error handler masks 5xx details and strips Zod error internals

---

## 5. Performance and Best Practices

**Result**: 0 critical | 3 high | 8 medium | 9 low | 5 positive findings

### HIGH

#### P-1: Three System Ownership Modules

- **Files**: `lib/assert-system-ownership.ts`, `lib/system-ownership.ts`, `lib/verify-system-ownership.ts`
- **Issue**: Three separate files implementing ownership checks with two distinct approaches. `system-ownership.ts` and `verify-system-ownership.ts` are functionally identical. Services inconsistently choose between them.
- **Recommendation**: Merge `system-ownership.ts` and `verify-system-ownership.ts` immediately. Document when to use sync (in-memory) vs async (DB) check.

#### P-2: Structure Membership Service — Textbook Code Duplication (591 lines)

- **File**: `services/structure-membership.service.ts`
- **Issue**: Three near-identical add/remove/list function trios for subsystem, side-system, and layer memberships. Only the table name and entity ID field differ.
- **Recommendation**: Extract a generic `addMembership<T>`, `removeMembership<T>`, `listMemberships<T>` — could reduce file by ~60%.

#### P-3: Inconsistent System ID Route Parameter Name

- **File**: `routes/systems/index.ts:42-57`
- **Issue**: Some sub-routes use `/:id` (groups, subsystems, layers) while others use `/:systemId` (members, fields, innerworld, blobs). Route handlers use `c.req.param("id") ?? ""` (fragile) vs `c.req.param("systemId") as string` (unsafe cast).
- **Recommendation**: Standardize all to `/:systemId` with `requireParam()`.

### MEDIUM

| ID   | Finding                                                                               | Location                                                                                                         |
| ---- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| P-4  | Structure link service — same duplication pattern (499 lines, 3 identical CRUD trios) | `services/structure-link.service.ts`                                                                             |
| P-5  | N+1 queries in `archiveRegion` — individual UPDATE per region/entity instead of batch | `services/innerworld-region.service.ts:334-353`                                                                  |
| P-6  | N+1 queries in `duplicateMember` — individual INSERT per photo/field value            | `services/member.service.ts:341-386`                                                                             |
| P-7  | Duplicate `encryptedBlobToBase64` in both `crypto-helpers.ts` and `encrypted-blob.ts` | `lib/crypto-helpers.ts`, `lib/encrypted-blob.ts`                                                                 |
| P-8  | Triple blob validation implementations (3 files, 3 signatures, same core logic)       | `lib/encrypted-blob.ts`, `lib/validate-encrypted-blob.ts`, `services/member.service.ts`                          |
| P-9  | Delete/archive operations return `{ ok: true }` with 200 instead of 204 No Content    | All delete/archive route handlers                                                                                |
| P-10 | PostgreSQL unique-violation code `"23505"` used as magic string in 8 locations        | `structure-membership.service.ts`, `structure-link.service.ts`, `group-membership.service.ts`, `auth.service.ts` |
| P-11 | Repeated unique-constraint catch pattern not abstracted (8 occurrences)               | Same files as P-10                                                                                               |

### LOW

| ID   | Finding                                                                               | Location                                                      |
| ---- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| P-12 | `MAX_ANCESTOR_DEPTH` duplicated (groups constants file + inline in subsystem service) | `groups.constants.ts`, `subsystem.service.ts:35`              |
| P-13 | `member.service.ts` inlines OCC check instead of using shared `assertOccUpdated`      | `services/member.service.ts:246-263`                          |
| P-14 | Ancestor-walk cycle detection duplicated in group and subsystem services              | `group.service.ts:391-405`, `subsystem.service.ts:255-270`    |
| P-15 | Four separate count queries in `deleteSubsystem` (could be one query)                 | `services/subsystem.service.ts:359-408`                       |
| P-16 | Reorder operations use per-row UPDATE loop (small collections, acceptable)            | `group.service.ts:523-534`, `member-photo.service.ts:261-277` |
| P-17 | Subsystem service (546 lines) — structurally identical to group service               | `services/subsystem.service.ts`                               |
| P-18 | Rotation state names as string literals (not extracted to constants)                  | `services/key-rotation.service.ts`                            |
| P-19 | `DEFAULT_PORT` not in constants file and lacks JSDoc                                  | `index.ts:18`                                                 |
| P-20 | Member-specific pagination constants identical to global ones (redundant)             | `routes/members/members.constants.ts`                         |

### Positive Findings

- Consistent error envelope (`{ error: { code, message, details? }, requestId }`) across all endpoints
- Cursor-based pagination consistently implemented across all list endpoints
- URL naming follows kebab-case plural nouns convention consistently
- PUT correctly used for all updates (E2E encrypted data = full replacement semantics)
- OCC helper (`assertOccUpdated`) well-designed and used by 9 services

---

## 6. Test Coverage

**Result**: 264 test files, 3872 tests, 0 failures (full monorepo); 107 files, 1107 tests (API project)

### Route-Level Test Gaps

| Domain                       | Route Files                                        | Route Tests | Severity     |
| ---------------------------- | -------------------------------------------------- | ----------- | ------------ |
| **blobs/**                   | 5 (upload-url, confirm, get, download-url, delete) | 0           | **CRITICAL** |
| **buckets/rotations/**       | 4 (initiate, claim, complete-chunk, progress)      | 0           | **CRITICAL** |
| **innerworld/entities/**     | 7 (full CRUD)                                      | 0           | **HIGH**     |
| **innerworld/regions/**      | 7 (full CRUD)                                      | 0           | **HIGH**     |
| **innerworld/canvas/**       | 1 (get/upsert)                                     | 0           | **HIGH**     |
| **account/audit-log**        | 1                                                  | 0           | **MEDIUM**   |
| **layers/memberships**       | 1                                                  | 0           | **MEDIUM**   |
| **side-systems/memberships** | 1                                                  | 0           | **MEDIUM**   |
| **subsystems/memberships**   | 1                                                  | 0           | **MEDIUM**   |

Note: All domains above have service-level tests. The gap is at the route/HTTP layer (input validation, auth enforcement, error mapping).

### Service-Level Coverage

All 30 service files have corresponding test files — 100% file coverage.

### Lib/Utility Test Gaps

| File                                                                | Severity | Notes                                          |
| ------------------------------------------------------------------- | -------- | ---------------------------------------------- |
| `pwhash-offload.ts` / `pwhash-worker-thread.ts`                     | HIGH     | Worker thread pool for Argon2id — untested     |
| `occ-update.ts`                                                     | MEDIUM   | Distinguishes 409 vs 404 — untested standalone |
| `validate-encrypted-blob.ts`                                        | MEDIUM   | Encryption serialization — untested standalone |
| `crypto-helpers.ts`                                                 | MEDIUM   | Duplicate of encrypted-blob.ts — untested      |
| `system-ownership.ts` / `assert-system-ownership.ts`                | MEDIUM   | Ownership checks — untested standalone         |
| `member-helpers.ts`                                                 | MEDIUM   | Helper functions — untested standalone         |
| `blob-usage-query.ts` / `blob-archiver.ts` / `orphan-blob-query.ts` | MEDIUM   | Blob infrastructure — untested                 |
| `storage.ts`                                                        | MEDIUM   | S3 storage adapter — untested                  |
| `pagination.ts`                                                     | LOW      | Pagination helper — untested standalone        |

### Middleware Test Gaps

| File                     | Severity |
| ------------------------ | -------- |
| `stores/valkey-store.ts` | MEDIUM   |
| `stores/memory-store.ts` | LOW      |
| `request-id.ts`          | LOW      |

### Test Quality Assessment

Sampled tests show strong quality: error cases covered, auth tested, input validation verified, edge cases handled, proper cleanup via `afterEach`. No cross-system access tests at route level (partially covered by service ownership checks).

### DX Note

The package-local `apps/api/package.json` test script is misleading — running tests from `apps/api/` fails. Tests must be run from the monorepo root via `pnpm vitest run --project api`.

---

## 7. Missing Endpoints

### M2 Scope (Actionable Now)

| Entity                | Missing Operation                                                                      | Severity |
| --------------------- | -------------------------------------------------------------------------------------- | -------- |
| **Members**           | `DELETE /:memberId` (permanent delete with dependents check)                           | HIGH     |
| **Member Photos**     | `DELETE /:photoId` (permanent delete)                                                  | HIGH     |
| **Auth**              | `POST /auth/password-reset/recovery-key` (unauthenticated recovery-key password reset) | HIGH     |
| **Groups**            | `POST /:groupId/copy` (folder duplication)                                             | MEDIUM   |
| **Members**           | `GET /:memberId/memberships` (member-centric membership view)                          | MEDIUM   |
| **Field Definitions** | `DELETE /:fieldId` (permanent delete)                                                  | MEDIUM   |
| **Blobs**             | `GET /` (list blobs for system — useful for quota UI)                                  | LOW      |

The API specification (section 9) explicitly describes deletion semantics with `HAS_DEPENDENTS` 409 responses. These are intended features not yet implemented.

### Post-M2 (Not in scope, documented for reference)

All post-M2 entities (fronting sessions, messaging, privacy buckets, friend connections, notifications, journals, API keys, webhooks, import/export, account purge) have DB schemas but zero API routes. This is expected per the milestone plan.

---

## 8. Consolidated Findings by Severity

### CRITICAL (4)

| ID  | Category | Finding                                                                                        |
| --- | -------- | ---------------------------------------------------------------------------------------------- |
| S-1 | Runtime  | Blob storage adapter never initialized — all blob routes will throw at runtime                 |
| S-2 | Runtime  | Multi-system ownership broken — in-memory check rejects legitimate non-primary system requests |
| T-1 | Testing  | Blob routes (5 handlers) have zero route-level tests                                           |
| T-2 | Testing  | Bucket key rotation routes (4 handlers) have zero route-level tests                            |

### HIGH (12)

| ID  | Category | Finding                                                                                         |
| --- | -------- | ----------------------------------------------------------------------------------------------- |
| S-3 | Security | Valkey rate limiter wiring broken — store captured before initialization, category keys collide |
| S-4 | Security | Session tokens stored unhashed, returned by listing endpoint, logged in audit details           |
| S-6 | Contract | Member archival permanently deletes field values (violates preservation contract)               |
| S-7 | Contract | Member duplication incomplete — `copyMemberships` accepted but is a no-op                       |
| S-8 | Feature  | Recovery-key password reset missing from auth API (crypto primitives exist)                     |
| T-3 | Testing  | Innerworld entities/regions/canvas routes (15 handlers) have zero route-level tests             |
| T-4 | Testing  | `pwhash-offload.ts` / `pwhash-worker-thread.ts` untested                                        |
| P-1 | Quality  | Three system ownership modules — two are functionally identical                                 |
| P-2 | Quality  | Structure membership service has 3 identical CRUD trios (591 lines)                             |
| P-3 | Quality  | Inconsistent system ID route parameter name (`/:id` vs `/:systemId`)                            |
| F-1 | Feature  | Members missing permanent DELETE endpoint                                                       |
| F-2 | Feature  | Member photos missing permanent DELETE endpoint                                                 |

### MEDIUM (18)

| ID   | Category | Finding                                                                               |
| ---- | -------- | ------------------------------------------------------------------------------------- |
| S-5  | Security | Privacy rule inconsistency — ownership check throws 403 instead of fail-closed 404    |
| P-4  | Quality  | Structure link service — same duplication pattern (499 lines)                         |
| P-5  | Quality  | N+1 queries in `archiveRegion`                                                        |
| P-6  | Quality  | N+1 queries in `duplicateMember`                                                      |
| P-7  | Quality  | Duplicate `encryptedBlobToBase64` definitions                                         |
| P-8  | Quality  | Triple blob validation implementations                                                |
| P-9  | Quality  | Delete/archive returns 200 `{ ok: true }` instead of 204                              |
| P-10 | Quality  | Magic string `"23505"` in 8 locations                                                 |
| P-11 | Quality  | Repeated unique-constraint catch pattern (8 occurrences)                              |
| B-1  | Bean     | api-dwou — lifecycle event type-specific validation not implemented (design mismatch) |
| B-2  | Bean     | api-s07n — audit log endpoint missing `resourceType` filter                           |
| F-3  | Feature  | Group/folder copy not implemented                                                     |
| F-4  | Feature  | No member-centric membership endpoint                                                 |
| F-5  | Feature  | Field definitions missing permanent DELETE endpoint                                   |
| T-5  | Testing  | Account audit-log route untested                                                      |
| T-6  | Testing  | Structure membership routes (3 domains) untested                                      |
| T-7  | Testing  | 6 lib utilities untested (occ-update, blob validation, ownership, member-helpers)     |
| T-8  | Testing  | Blob infrastructure classes untested (storage, archiver, usage-query, orphan-query)   |

### LOW (18)

| ID   | Category | Finding                                                                           |
| ---- | -------- | --------------------------------------------------------------------------------- |
| S-9  | Security | Session ID param not validated on DELETE sessions                                 |
| S-10 | Security | Read endpoints lack per-category rate limit                                       |
| S-11 | Security | Audit log query lacks specific rate limit                                         |
| S-12 | Security | HSTS preload directive missing                                                    |
| S-13 | Security | Two functionally identical ownership modules                                      |
| S-14 | Security | Request IDs are UUIDv4 not UUIDv7 per API spec                                    |
| P-12 | Quality  | `MAX_ANCESTOR_DEPTH` duplicated                                                   |
| P-13 | Quality  | `member.service.ts` inlines OCC check                                             |
| P-14 | Quality  | Ancestor-walk cycle detection duplicated                                          |
| P-15 | Quality  | Four separate count queries in `deleteSubsystem`                                  |
| P-16 | Quality  | Reorder operations use per-row UPDATE loop                                        |
| P-17 | Quality  | Subsystem service structurally identical to group service                         |
| P-18 | Quality  | Rotation state names as string literals                                           |
| P-19 | Quality  | `DEFAULT_PORT` not in constants file                                              |
| P-20 | Quality  | Member-specific pagination constants redundant                                    |
| B-3  | Bean     | api-uixu — S3 cleanup job missing                                                 |
| B-4  | Bean     | api-yp99 — wrong constant used in UpdateSystemBodySchema                          |
| B-5  | Bean     | api-swt5 — bean summary doesn't match implementation                              |
| F-6  | Feature  | Blobs missing list endpoint                                                       |
| L-1  | Spec     | Custom fields capped at 200 despite "unlimited" wording — document or remove      |
| L-2  | Spec     | Subsystem nesting capped at 50 despite "no hard depth limit" — document or remove |
| L-3  | DX       | Package-local API test script misleading in monorepo context                      |

---

## 9. Recommended Actions

### Immediate (must fix before M3)

1. **Initialize blob storage adapter** in `index.ts` during `start()` — blob routes are non-functional without this
2. **Fix multi-system ownership** — replace all `assertSystemOwnership` (in-memory) usages with DB-backed `verifySystemOwnership`, or remove `systemId` from auth context and verify per-request
3. **Fix Valkey rate limiter wiring** — resolve the store lazily at request time, not at construction; include category in rate limit keys
4. **Hash session tokens** before DB storage (`BLAKE2b(token)` as session ID); return only opaque identifiers from `listSessions`; truncate/hash tokens in audit logs
5. **Fix member archival** — preserve field values (archive, don't delete) to match read-only preservation contract
6. **Implement `copyMemberships`** in member duplication service or remove from schema
7. **Add permanent DELETE endpoints** for members, member photos, and field definitions with `HAS_DEPENDENTS` 409 pattern
8. **Add recovery-key password reset endpoint** (`POST /auth/password-reset/recovery-key`)

### Short-term (early M3)

9. **Add route-level tests** for blobs, key rotation, innerworld, audit-log, and structure-membership routes
10. **Consolidate system ownership modules** — merge `system-ownership.ts` and `verify-system-ownership.ts`; align all to 404 for fail-closed privacy
11. **Extract generic CRUD factories** for structure-membership and structure-link services to eliminate ~60% duplication
12. **Standardize route parameter** to `/:systemId` across all system sub-routes
13. **Consolidate blob validation** into a single `encrypted-blob.ts` module; remove `crypto-helpers.ts` and `validate-encrypted-blob.ts`
14. **Extract `PG_UNIQUE_VIOLATION`** constant and `handleUniqueViolation` helper
15. **Add tests for pwhash worker**, occ-update, and blob infrastructure utilities

### Deferred (track as beans)

16. Add `resourceType` filter to audit log query endpoint
17. Add group/folder copy endpoint
18. Add member-centric membership endpoint (`GET /members/:memberId/memberships`)
19. Batch N+1 queries in `archiveRegion` and `duplicateMember`
20. Extract ancestor-walk cycle detection into shared helper
21. S3 lifecycle cleanup background job for archived blobs
22. Resolve api-dwou design decision (lifecycle event type-specific validation)
23. Evaluate 204 No Content vs 200 `{ ok: true }` for void operations
24. Switch request IDs to UUIDv7 per API spec
25. Document custom field cap (200) and subsystem depth cap (50)
