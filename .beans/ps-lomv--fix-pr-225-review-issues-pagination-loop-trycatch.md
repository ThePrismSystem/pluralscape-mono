---
# ps-lomv
title: "Fix PR 225 review issues: pagination loop, try/catch, type safety, tests"
status: completed
type: task
priority: normal
created_at: 2026-03-21T05:32:54Z
updated_at: 2026-03-21T05:42:35Z
---

Fix all critical/important/suggestion issues from PR 225 review:

- [x] CRITICAL: Add collectAllEnvelopes server-side loop
- [x] IMPORTANT: Wrap verifyEnvelopeSignature in try/catch
- [x] IMPORTANT: Add discriminant to SubmitChangeResult
- [x] IMPORTANT: Fix onSuccess type safety in dispatchWithAccess
- [x] SUGGESTION: Valid-signature happy-path test
- [x] SUGGESTION: PgSyncRelayService hasMore:true tests
- [x] SUGGESTION: Message-router signature verification test
- [x] Run all tests and typecheck

## Summary of Changes

Fixed all critical, important, and suggestion-level issues from PR #225 review:

1. **collectAllEnvelopes helper** — server-side loop prevents silent truncation for documents exceeding page size
2. **try/catch around verifyEnvelopeSignature** — InvalidInputError now returns INVALID_ENVELOPE instead of INTERNAL_ERROR
3. **SubmitChangeResult discriminant** — added `type: "SubmitChangeResult"` for proper discriminated union
4. **dispatchWithAccess type safety** — onSuccess context parameter now `C | undefined`, removed unsafe `as C` cast
5. **Valid-signature happy-path test** — proves real signed envelopes pass verification
6. **Malformed-input test** — proves wrong byte lengths return INVALID_ENVELOPE
7. **PgSyncRelayService hasMore:true tests** — unit + integration tests for pagination
8. **Message-router signature verification test** — verifies INVALID_ENVELOPE sent, no broadcast, no ownership set
