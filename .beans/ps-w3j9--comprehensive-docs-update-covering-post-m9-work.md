---
# ps-w3j9
title: Comprehensive docs update covering post-M9 work
status: completed
type: task
priority: normal
created_at: 2026-04-21T03:55:54Z
updated_at: 2026-04-21T11:44:47Z
---

Full sweep of repo docs to reflect 80 PRs merged since the last comprehensive docs update (PR #424 on 2026-04-14). Covers README, CHANGELOG, milestones, features, architecture, OpenAPI spec, db schema diagram, 15 package READMEs, trpc/REST consumer guides, and new CONTRIBUTORS.md. Marks Milestone 9 (ps-h2gl) completed at end.

## Phase progress

- [x] Phase 0: Evidence gathering (Task 0)
- [x] Phase 1a: Architecture / milestones / features / api-spec (Tasks 1-4, Commit 1 = 8137aaf8)
- [x] Phase 1b: README + CHANGELOG (Tasks 5-6, Commit 2 = 07bf8135)
- [x] Phase 2a: Database schema (Task 7, Commit 3 = 62eaa883)
- [x] Phase 2b: OpenAPI (Task 8, Commit 4 = c5adae53)

**Deferred: OpenAPI list-wrapper inconsistency.** 25+ list endpoints use varied response keys (items/members/groups/sessions/...) in the OpenAPI spec while server handlers return `data` via `buildPaginatedResult`. Needs either spec-wide rename to `data` or an ADR settling on `items` and changing the server. Out of budget for this docs refresh — follow-up bean to be created at end.

- [x] Phase 2c: Guides (Tasks 9-11, Commit 5 = 4b45b894)
- [x] Phase 2d: CONTRIBUTING (Task 12, Commit 6 = 0cf3f9a3)
- [x] Phase 2e: ADR accuracy (Task 13, Commit 7 = 5c8e955a)
- [x] Phase 3a: Package READMEs batch 1 (Task 14, Commit 8 = 9a5656ad)
- [x] Phase 3b: Package READMEs batch 2 (Task 15, Commit 9 = 80cd9f3f)
- [x] Phase 3c: Package READMEs batch 3 (Task 16, Commit 10 = 11e3f336)
- [x] Phase 4: Close beans (Task 17, Commit 11)
- [x] Phase 5: Pre-PR verification (Task 18)

**Deferred: SCOPE_INSUFFICIENT constant vs handler behavior.** `SCOPE_INSUFFICIENT` is defined in `packages/types/src/api-constants/error-codes.ts` but no handler throws it — handlers use `FORBIDDEN` for scope denials. OpenAPI spec (Task 8) lists it in the ErrorResponse enum. Minor spec-vs-code divergence; follow-up bean to decide: emit `SCOPE_INSUFFICIENT` from scope-gate middleware, or remove from constants + OpenAPI enum.

## Summary of Changes

Completed three-pass accuracy review (claim extraction → ground-truth check → gap fill) across all user-facing documentation.

### Root docs

- README.md — refreshed REST op/domain counts (317/32), ADR count (37), added logger package, M9 paragraph.
- CHANGELOG.md — new "2026-04-21 — Milestone 9 closeout" section with 6 thematic subsections (Imports, Zero-Knowledge, i18n, Audit Remediation, CI/Security/Deps, Infra).
- CONTRIBUTING.md — post-M9 gates (openapi:check, trpc:parity), zero-knowledge rule, Crowdin workflow (ADR 036), beans workflow, pre-release code hygiene, coverage threshold 89%.

### Planning docs

- milestones.md — ADR count 34→37, M9 scope bullets verified.
- features.md — REST 304→317, domains 31→32, 38 top-level routers (i18n.ts is composed into i18nRouter via i18n-composer.ts), dual-source import framing, new i18n/OPFS/zero-knowledge/import-core bullets.
- api-specification.md — no edits required (reviewed, all accurate).

### Architecture and schema

- docs/architecture.md — ADR 031/033/034/035/036/037 citations added; zero-knowledge master-key migration; OPFS/wa-sqlite; T2 algorithm XChaCha20-Poly1305 correction.
- docs/database-schema.md — 62/68 tables PASS; fixed drift in accounts (auth_key_hash replaces password_hash; challenge columns), recovery_keys (recovery_key_hash), timer_configs (next_check_in_at), device_tokens (token_hash), import_jobs (checkpoint_state).

### API references

- docs/openapi/openapi.yaml + docs/openapi.yaml — 6 per-route fixes (auth envelope, duplicate-member defaults, fronting query params, import body enum, INVALID_STATE error, full api-key scope enum regen from ALL_API_KEY_SCOPES).
- docs/trpc-guide.md — example signatures corrected (encryptedData vs plaintext); router table camelCase vs kebab-case; 3 missing routers added; scope-gate middleware note.

### Consumer guides

- docs/guides/api-consumer-guide.md — login salt endpoint POST /v1/auth/salt; FORBIDDEN (not SCOPE_INSUFFICIENT); rate-limit categories 17→19; new 8.6 Import Jobs section.
- docs/guides/api-key-scopes.md — FORBIDDEN error code; scope count verified (68 = 21 domains × 3 + 1 + 4).
- docs/guides/{mobile-developer,sync-protocol,webhook-signature-verification}.md — reviewed, all accurate.

### ADR accuracy

- ADR 006 — "Unified KDF Profile" → "Master-Key KDF Profile"; constants renamed per ADR 037.
- ADR 036 — Native `gh pr merge --auto` flow (removed custom automerge workflow description); corrected MT engine coverage (es-419 has no MT engine).
- ADRs 035, 037, 013 — verified accurate, no changes.

### Package READMEs (15)

- api-client, crypto, data, db, email (batch 1) — retry middleware, zero-knowledge framing, Argon2id profiles, transform table corrections, migration policy, ReDoS fix.
- i18n, import-core, import-pk, import-sp, queue (batch 2) — OTA proxy, Persister interface, dual source modes, SP auth quirk, Valkey gate.
- rotation-worker, storage, sync, types, validation (batch 3) — key zeroing, exact-size contract, async SqliteDriver, brandId, schema catalog.

### Follow-ups resolved (same branch)

All four items originally deferred were resolved before opening the PR:

1. **OpenAPI list-wrapper rename** → commit `4a5ea65d`: 3 schemas + 38 inline renames across 23 path files, all list wrapper keys normalized to `data` to match `buildPaginatedResult`.
2. **SCOPE_INSUFFICIENT emission** → commit `28566d45`: REST scope-gate middleware distinguishes `FORBIDDEN` (endpoint not registered) from `SCOPE_INSUFFICIENT` (scope mismatch). tRPC scope-gate keeps `FORBIDDEN` (code enum fixed). Docs updated.
3. **Orphan `apps/api/src/trpc/routers/i18n.ts`** → INVALID; `i18n-composer.ts` imports `createI18nRouter` from `i18n.ts` and wires it into `root.ts`. Both files are live.
4. **Missing `packages/logger/README.md`** → commit `50126200`: new README for `@pluralscape/logger` covering mobile logger, default PII redaction, options, testing, design rationale.

All four items verified: `openapi:check`, `openapi:lint`, `trpc:parity`, scope-gate tests (8/8 pass).

Milestone 9 (ps-h2gl) marked completed.
