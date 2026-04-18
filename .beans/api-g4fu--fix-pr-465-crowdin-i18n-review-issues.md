---
# api-g4fu
title: "Fix PR #465 Crowdin i18n review issues"
status: completed
type: task
priority: high
created_at: 2026-04-17T23:54:56Z
updated_at: 2026-04-18T02:08:25Z
parent: ps-0enb
---

## Context

Multi-agent review of PR #465 (Crowdin i18n integration) surfaced one latent production bug (Hono sub-app routing would 404 in prod), three bare `catch {}` blocks on mobile, unvalidated Crowdin CDN payloads, type-design gaps, and near-vacuous E2E coverage.

Design: `docs/superpowers/specs/2026-04-17-pr-465-review-fixes-design.md`
Plan: `docs/superpowers/plans/2026-04-17-pr-465-review-fixes.md`

## Todo

- [x] Phase 1: `fix(api): correct i18n route dispatch + harden Crowdin proxy` (commit 55881818)
- [x] Phase 2: `refactor(api): consolidate i18n shared types and helpers` (commit 382496c4)
- [x] Phase 3: `fix(mobile): error handling, fetchedAt-on-304, unified TTL` (commit b5a69992)
- [x] Phase 4: `refactor(types): Locale literal union, branded Etag, non-empty manifest` (commit e1f9d55d)
- [x] Phase 5: `test: local Crowdin stub + coverage gaps + shared helpers` (commit d8dd821f)
- [x] Phase 6: `docs: adr 035 + openapi 404 + strip task references` (commit 4681bbc8)
- [x] Full `/verify` passes on the stack (lint 16/16, typecheck 20/20, unit 12422/12423 pass, e2e 506 pass)

## Scope

Single PR on top of `feat/crowdin-i18n-integration`, six per-domain commits.

## Summary of Changes

Six per-domain commits on top of `feat/crowdin-i18n-integration` addressing all critical/important issues and suggestions from the multi-agent PR review.

- **55881818 fix(api): correct i18n route dispatch + harden Crowdin proxy** — collapse sub-app factories to plain handlers (fixes production 404 bug), Zod validation at Crowdin boundary, best-effort cache writes, `didTimeout` flag, evict corrupt Valkey entries, tRPC logging parity
- **382496c4 refactor(api): consolidate i18n shared types and helpers** — `services/i18n-shared.ts` + `services/i18n-deps.ts`, tagged-union `CrowdinOtaFailure`, dedup across REST/tRPC
- **b5a69992 fix(mobile): error handling, fetchedAt-on-304, unified TTL** — three bare `catch {}` replaced with bound+logged handlers, corrupt cache eviction, 304 refreshes `fetchedAt`, unified 24h TTL
- **e1f9d55d refactor(types): locale literal union, branded etag, non-empty manifest** — `Locale = (typeof SUPPORTED_LOCALES)[number]`, branded `Etag` via `asEtag()`, `readonly [L, ...L[]]` tuple, `I18nNamespaceWithEtag`
- **d8dd821f test: local Crowdin stub + coverage gaps + shared helpers** — `startCrowdinStub` + `CROWDIN_OTA_BASE_URL` env, precise E2E assertions (ETag 304 round-trip, 5xx → 502, 404 → 404), tRPC Zod/rate-limit tests, 65-case locale × namespace matrix, shared test helper, setup-failure stub cleanup
- **4681bbc8 docs: adr 035 + openapi 404 + strip task references** — ADR 035 corrections + unified 24h TTL reference, OpenAPI 404 for `NAMESPACE_NOT_FOUND`, strip M8/follow-up-ADR leaks, noise JSDoc cleanup, README pointer to ADR 035

## Follow-up beans

- `mobile-1tvj` — Add concrete mobile logger implementation (mobile has no structured logger; used `globalThis.console.warn` for now)
- `api-r6r9` — Document in-memory Valkey fallback + production warning (`InMemoryValkeyCacheClient` was added for single-instance / E2E; operator docs pending)
