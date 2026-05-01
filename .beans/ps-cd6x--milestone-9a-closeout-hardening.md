---
# ps-cd6x
title: "Milestone 9a: Closeout Hardening"
status: completed
type: milestone
priority: normal
created_at: 2026-04-21T13:54:01Z
updated_at: 2026-05-01T22:07:50Z
---

Post-M9 closeout of structural debt and audit-gap items not covered by the per-package 2026-04-20 remediation epics (crypto-cpir, api-v8zu, db-bry7, mobile-e3l7, sync-me6c). The 2026-04-20 audit's three CRITICAL findings are verified fixed; what remains is MEDIUM/LOW severity structural work that the per-package remediation deliberately scoped out.

Specification: docs/superpowers/specs/2026-04-21-m9a-closeout-hardening-design.md

## In scope

- API service layer god-file refactor (15 files over 500 LOC → services/<domain>/<verb>.ts, each ≤300 LOC)
- packages/types as single source of truth for domain entity types (Drizzle, Zod, OpenAPI derive-or-assert-equal)
- Test file maintainability (split the 3 worst, umbrella for the remaining 16)
- Closeout hygiene (typed Hono context, RLS-wrapper lint rule, mobile test factories, queue-mock typing, ADR supersession fields, dev-only constants module, service-file LOC cap)
- Branded-ID drift cleanup across the 5 surfaces flagged by the 2026-04-20 audit pattern list

## Out of scope (deferred to named milestones)

- audit_log retention/drop job → M15 Polish and Launch (ps-9u4w)
- Versioned PARTITION BY migration → M15 (ps-9u4w)
- Mobile import-sp bundle-impact measurement → M12 Data Interpolation (ps-8coo)

## Blocks / blocked-by

- blocked-by: ps-h2gl (M9 Data Import) — logical ordering; M9 already completed
- blocks: ps-9cca (M10 UI/UX Design) — ps-9cca blocked-by will be updated to include this milestone

## Completion criteria

All direct and transitive child beans completed. Drift-regression gates in CI: types-SoT parity checks green, service-file LOC cap enforced, RLS-wrapper lint rule enforced.

## Summary of Changes

M9a closeout shipped 32 child beans across 7 themes, plus 1 scrapped (api-xol4 — premise verified incorrect):

1. **Types SoT** — types-ltel (10 plaintext clusters: foundation, auth/devices, members/identity, fields, structure, fronting/lifecycle, innerworld, communication/engagement, operational, privacy-social), ps-y4tb (canonical type chain across 33 encrypted entities — originally scoped at 28, expanded by brand fleet additions), EncryptedWire<T> hardening (types-emid/ps-6lwp/types-cfp6), branded-ID drift cleanup (ps-q8vs), brand fleet expansion (Note.title/content, Poll.title/PollOption.label, FieldDefinition.name, FrontingSession.comment/positionality/outtrigger, lifecycle-event display brands), plaintext entity SoT consolidation (ps-6phh), discriminated Archivable<T> chain (types-0e9j).

2. **API Service Layer** (api-6l1q) — 26 services split per-verb under services/<domain>/<verb>.ts (Option E, no barrels), shared checkDependents helper, ESLint max-lines:450 cap on services.

3. **DB Schema Lifts** — brandedId<B>() Drizzle helper (db-drq1), UnixMillis customType lift (C11b), three-schema-set split (ADR-038: server PG, server SQLite, client-cache SQLite), SQLite client-cache schemas + materializer DDL refactor (db-jv3w), materializer subscriber wired to SyncEngine (sync-xjfi).

4. **LOC Ceilings** (ps-r5p7) — codified as ESLint max-lines rules in tooling/eslint-config/loc-rules.js, replacing ad-hoc enforcement; Tier B ratchet splits across 6 modules (api/lib scope-registry, api/ws message-router, queue bullmq, mobile trpc-persister-api, import-core import-engine, peers).

5. **Test Maintainability** (ps-36rg) — 40+ oversized test files split by concern across api/db/sync/mobile/import-core/import-sp/queue/crypto; service tests split by verb; RLS policy tests split by RLS scope; crypto key-lifecycle tests split by lifecycle phase.

6. **Wiring Closeout** — materializerRegistry into data-layer write path (sync-xjfi), decryptDeviceInfo at session-list endpoint (api-bqu4), decode-blob asserts inlined post-friend-dashboard migration (ps-znp0), OPFS wa-sqlite driver for the web platform adapter.

7. **CI / Deps** — Renovate batches consolidated; Hono 4.12.15, i18next 26.0.8, pglite 0.4.5, expo monorepo, @journeyapps/wa-sqlite 1.7.0, aws-sdk-js-v3 3.1038.0, tanstack-query 5.100.5; node-gyp install fix; nodemailer 8.0.7; postcss bump.

Drift-regression gates in CI: types-SoT parity (`pnpm types:check-sot`), service-file LOC cap (ESLint max-lines), RLS-wrapper lint rule.

ADRs touched: 038 (three Drizzle schema sets) added; 023 (Zod type alignment) amended.

Documentation: refreshed root narrative (README, CHANGELOG, CONTRIBUTING, architecture, planning/{milestones,api-specification}), database-schema with three-schema-set framing, OpenAPI source + bundle (per-route SessionListResponse and listMembers query-param fixes), tRPC guide (EncryptedWire<T> + subscriptions), 5 consumer guides, ADR accuracy on 023+038, all 16 package READMEs.
