---
# mobile-62f6
title: Ratchet mobile/src LOC cap from 850 to 500 (split trpc-persister-api.ts)
status: completed
type: task
priority: normal
created_at: 2026-05-01T11:37:32Z
updated_at: 2026-05-01T12:41:42Z
parent: ps-cd6x
---

Tier B ratchet follow-up from ps-r5p7. Split apps/mobile/src/features/import-sp/trpc-persister-api.ts (currently 824 LOC) using barrel pattern, then lower the cap value in tooling/eslint-config/loc-rules.js from 850 to 500. Spec: docs/superpowers/specs/2026-04-30-loc-ceilings-eslint-rules-design.md

## Summary of Changes

Split apps/mobile/src/features/import-sp/trpc-persister-api.ts (824 LOC) into:

- trpc-persister-api.ts — orchestrator (41 LOC)
- trpc-persister-api.types.ts — TRPCClientSubset, FetchFn, AVATAR_ENCRYPTION_TIER (292 LOC)
- trpc-persister-api.helpers.ts — sha256Hex, defaultFetch (42 LOC)
- trpc-persister-builders/system-and-buckets.ts — system, systemSettings, bucket, customFront, member, friend, field (142 LOC)
- trpc-persister-builders/fronting-and-content.ts — frontingSession, frontingComment, note, poll (152 LOC)
- trpc-persister-builders/messaging-and-groups.ts — channel, message, boardMessage, group (149 LOC)
- trpc-persister-builders/blob-and-refs.ts — blob, importEntityRef (95 LOC)

Cap drop also exposed import.hooks.ts (622 LOC) above 500. Split it into:

- import.hooks.ts — useStartImport, useResumeActiveImport, useCancelImport, setup helpers (494 LOC)
- import-progress.hooks.ts — useImportJob, useImportProgress, useImportSummary + helpers (158 LOC)

Re-exports in import.hooks.ts preserve the public surface for existing callers and tests. Lowered B10 cap in tooling/eslint-config/loc-rules.js from 850 to 500. createTRPCPersisterApi composes from the four builder sections via spread.

Verified: pnpm typecheck, pnpm lint --filter=@pluralscape/mobile, pnpm vitest run --project mobile (1366 passed), pnpm lint:loc — all pass.
