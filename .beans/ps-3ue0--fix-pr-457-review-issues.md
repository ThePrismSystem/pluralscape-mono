---
# ps-3ue0
title: 'Fix PR #457 review issues'
status: completed
type: task
priority: normal
created_at: 2026-04-16T12:15:57Z
updated_at: 2026-04-16T12:18:34Z
---

Address all review findings from PR #457: add systemId filter to notes query, z.NEVER in webhook, remove re-export from handlers, extract firstRecipient, add entityId regex tests

## Summary of Changes

1. **Added `systemId` filter to notes dependency query** — `structure-entity-crud.service.ts` notes count query now includes `eq(notes.systemId, systemId)` for consistency with the other three dependency queries and index utilization
2. **Replaced `return undefined` with `return z.NEVER`** — `webhook.ts` timestamp transform now uses idiomatic Zod v4 pattern after `ctx.addIssue()`
3. **Removed `shouldVerifyEnvelopeSignatures` re-export** — `handlers.ts` now imports `shouldVerifyEnvelopeSignatures` directly as a named import instead of namespace import; test file updated to import from `envelope-verification-config.js`
4. **Extracted `firstRecipient` in `validateSendParams`** — `email.constants.ts` derives `firstRecipient` once at the top of the function instead of 4 duplicate derivations
5. **Added entityId regex rejection tests** — 6 new test cases in `privacy.test.ts` covering prefix separator, uppercase prefix, single-char prefix, empty suffix, special characters, and hyphenated UUID acceptance
