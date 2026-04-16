---
# api-8k1w
title: Fix all WebSocket server PR review findings
status: completed
type: task
priority: normal
created_at: 2026-03-19T22:17:31Z
updated_at: 2026-04-16T07:29:45Z
parent: api-fh4u
---

Address all 3 critical, 19 important, and 17 suggestion-level issues from PR #192 review across correctness, security, type safety, test coverage, and code quality. Steps 1-11 covering shared utilities, constants, relay fixes, crypto exports, schema validation, connection manager safety, auth handler hardening, message router fixes, broadcast/pubsub fixes, origin validation, and E2E tests.

## Summary of Changes

Addressed all findings from PR #192 multi-model review across 11 implementation steps:

### New files

- `ws.utils.ts` — `formatError()` and `makeSyncError()` shared utilities (replaced 12+ inline patterns)
- `sliding-window-counter.ts` — extracted rate limiter with window-offset-preserving rotation
- `origin-validation.ts` — extracted `isAllowedOrigin()` from index.ts for testability

### Correctness (Critical)

- C1: Auth handler wraps getDb/validateSession in try/catch, returns AUTH_FAILED on infrastructure errors
- C2: Broadcast wraps serializeServerMessage in try/catch, returns early on failure
- C3: ManifestRequest now validates systemId matches authenticated connection
- C4: Added JSDoc explaining TOFU safety (ephemeral relay, E2E encryption, eviction cleanup)

### Correctness (Important)

- I1: LRU eviction skips when incoming doc already tracked (early return)
- I2: Rate limiter window rotation uses offset (`windowStart += windowMs`) not `windowStart = now`
- I3: Eviction triggers subscription cleanup via `removeSubscriptionsForDoc()`
- I4: authenticate() only decrements unauthCount from awaiting-auth phase
- I5: releaseUnauthSlot() guards against negative with Math.max(0, ...)
- I6: Safety timeout releases unauth slot if onOpen never fires
- I7: SubmitChangeRequest skips broadcast if send to submitter fails
- I8: ValkeyPubSub removes handler on subscribe failure
- I9: Resubscribe .then() chain has .catch() handler
- I10: DocumentLoadRequest checks first send before sending second
- I11: addSubscription returns boolean, rejects at WS_MAX_SUBSCRIPTIONS_PER_CONNECTION (500)
- I12: Empty catch blocks replaced with log.debug()
- I15: handleSubmitChange wrapped in try/catch, sends SyncError on failure
- I16: broadcastDocumentUpdate returns BroadcastResult {delivered, failed, total}
- I17: SubscribeRequest checks docs individually — permits allowed, denies denied
- I18/I19: Base64url regex validation before transform

### Type safety

- T1: Zod schemas enforce nonce (24B), signature (64B), authorPublicKey (32B) via .refine()
- T2: Added JSDoc explaining `as SystemId` cast safety
- S5: CLIENT_MESSAGE_SCHEMAS typed with `satisfies Record<ClientMessage['type'], ZodType>`

### Code quality

- S1: Strike decay by 1 instead of reset to 0
- S2: O(log n) getEnvelopesSince via binary search + slice
- S3: O(1) LRU via Map insertion-order trick
- S4: PROFILE_TYPES extracted as const array, ProfileType derived from it
- S6: subscribedDocs made readonly
- S7: Flat rate-limit fields replaced with SlidingWindowCounter objects
- S9: ClosingState removed (dead code)
- S12: checkDocumentAccess inlined into checkAccess
- S13: Error messages sanitized (no user input echo, Zod details logged server-side only)
- S14: Comment documenting null Origin acceptability

### Tests added

- ws-utils.test.ts (formatError, makeSyncError)
- sliding-window-counter.test.ts (within limit, over limit, rotation, offset preservation)
- origin-validation.test.ts (test/dev env, undefined origin, allowed/disallowed origins)
- auth-handler: getDb throws, validateSession throws
- connection-manager: negative guard, phase guard, subscription cap, removeSubscriptionsForDoc
- message-router: ManifestRequest wrong systemId, partial subscribe, send failure skips broadcast, strike decay, window offset
- broadcast: serialization failure, BroadcastResult
- valkey-pubsub: handler removal on subscribe failure
- message-schemas: invalid base64url, wrong byte lengths
- E2E: auth timeout, snapshot submit flow, correct byte-length test data
