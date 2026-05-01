---
# ps-zaq5
title: Docs refresh — M9a closeout
status: completed
type: task
priority: normal
created_at: 2026-05-01T21:31:34Z
updated_at: 2026-05-01T22:08:05Z
parent: ps-cd6x
---

Comprehensive docs refresh post-M9a. Spec: docs/superpowers/specs/2026-05-01-m9a-closeout-docs-refresh-design.md. Plan: docs/superpowers/plans/2026-05-01-m9a-closeout-docs-refresh.md. Closes ps-cd6x at completion.

## Summary of Changes

Comprehensive accuracy pass on all in-scope user-facing docs against the 73-PR window since #532 (2026-04-21).

- Root narrative: README, CHANGELOG (new M9a closeout section), CONTRIBUTING, architecture, planning/{milestones, api-specification}. features.md required no edits. Mid-pass corrective commit fixed encrypted-entity count from 28 (brief carryover) to 33 (actual count post brand-fleet expansion) across README, CHANGELOG, milestones.md.
- Technical references: database-schema (three-set framing), OpenAPI spec (SessionListResponse shape correction in auth.yaml; listMembers query params added in members.yaml), tRPC guide (EncryptedWire<T> + Subscriptions sections, scope-registry split path correction), api-consumer-guide (field-visibility paths corrected), api-key-scopes (verified, no edits), mobile-developer-guide (Expo SDK 55, OPFS wa-sqlite, mobile LOC ceiling), sync-protocol (materializer subscriber + ADR-038 client-cache wiring, validator file structure), webhook-signature-verification (Class E payload encryption callout).
- ADR accuracy: 023 (M9a closeout subsection added to Consequences); 038 (verified, no edits).
- 16 package READMEs refreshed across 4 batches (types/db/validation/data, sync/crypto/api-client/queue, import-core/import-pk/import-sp/storage, email/i18n/rotation-worker/logger). i18n required no edits.
- Bean ps-cd6x closed with full M9a Summary of Changes.

Verification gates green at completion: pnpm format, pnpm lint, pnpm typecheck, pnpm openapi:check, pnpm trpc:parity, pnpm types:check-sot.

Coverage at completion: 95.12% statements, 95.83% lines, 89.07% branches, 94.66% functions.
