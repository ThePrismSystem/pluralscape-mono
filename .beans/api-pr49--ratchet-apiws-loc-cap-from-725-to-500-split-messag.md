---
# api-pr49
title: Ratchet api/ws LOC cap from 725 to 500 (split message-router.ts)
status: completed
type: task
priority: normal
created_at: 2026-05-01T11:37:32Z
updated_at: 2026-05-01T12:27:05Z
parent: ps-cd6x
---

Tier B ratchet follow-up from ps-r5p7. Split apps/api/src/ws/message-router.ts (currently 719 LOC) using barrel pattern, then lower the cap value in tooling/eslint-config/loc-rules.js from 725 to 500. Spec: docs/superpowers/specs/2026-04-30-loc-ceilings-eslint-rules-design.md

## Summary of Changes

Split apps/api/src/ws/message-router.ts (719 LOC) into:

- message-router.ts — RouterContext, createRouterContext, send/parseMessage/checkAccess helpers, routeMessage entry, applyRateLimit, handleAwaitingAuth (407 LOC)
- message-router-cases.ts — 8 per-message-type case handlers (handleManifestRequestCase ... handleDocumentLoadRequestCase) (463 LOC)

Helpers exported with named types (SendFn, ParseMessageFn, CheckAccessFn) and bundled as CaseHelpers passed to each case. Cases also receive the AuthenticatedState narrowing from connection-state.ts. Lowered B9 cap in tooling/eslint-config/loc-rules.js from 725 to 500. Public API unchanged (createRouterContext, routeMessage, RouterContext).

Verified: pnpm typecheck, pnpm lint --filter=@pluralscape/api, pnpm vitest run --project api ws tests (368 passed), pnpm lint:loc — all pass.
