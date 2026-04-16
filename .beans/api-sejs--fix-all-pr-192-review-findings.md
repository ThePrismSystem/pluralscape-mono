---
# api-sejs
title: "Fix all PR #192 review findings"
status: completed
type: task
priority: normal
created_at: 2026-03-19T23:39:15Z
updated_at: 2026-04-16T07:29:45Z
parent: ps-afy4
---

Address all 17 review findings from PR #192: 2 critical protocol bugs, 9 important issues, 6 suggestions. Covers ws.utils, message-schemas, sliding-window-counter, connection-state, connection-manager, message-router, index, handlers, broadcast, auth-handler, origin-validation, valkey-pubsub.

## Summary of Changes

Addressed all 17 PR #192 review findings:

**Critical (#1, #2):**

- Added try/catch around handleSubmitSnapshot in router (prevents client hang on unexpected errors)
- Always send SubscribeResponse even when all docs are denied (prevents client hang waiting for response)

**Important (#3-#12):**

- Auth timeout now calls connectionManager.remove() for cleanup even if ws.close() throws
- Origin validation trims whitespace from ALLOWED_ORIGINS entries
- handleSubscribeRequest checks addSubscription return value, skips docs beyond subscription cap
- Broadcast serialization failure now reports failed=subscribers.size instead of misleading 0
- Broadcast send failure catch block now captures and logs the error
- Branded Zod schema transforms (AeadNonce, Signature, SignPublicKey) eliminate as-casts in router
- brandedSetHas utility replaces unsafe as-cast in auth-handler
- ValkeyPubSub.subscribe() returns 'subscribed' | 'deferred' | 'failed' outcome
- Binary frames now get a MALFORMED_MESSAGE error response instead of silent drop
- Removed redundant manager parameter from routeMessage (available via ctx.manager)

**Suggestions (#13-#17):**

- Consolidated two JSON validation guards into single hasStringType type guard
- SlidingWindowCounter fields made private with seed()/snapshot() accessors
- SystemId branded type used in connection-state, connection-manager, and message-router
- brandedSetHas encapsulates the single-location as-cast for Set membership
- Removed unsafe 'as { type: unknown }' cast via type guard function
