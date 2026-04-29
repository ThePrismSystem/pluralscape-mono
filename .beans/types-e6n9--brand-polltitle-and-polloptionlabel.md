---
# types-e6n9
title: Brand Poll.title and PollOption.label
status: completed
type: task
priority: normal
created_at: 2026-04-27T21:25:41Z
updated_at: 2026-04-29T09:27:18Z
parent: ps-cd6x
---

Poll.title and PollOption.label are sibling free-text fields across the parent/child relationship; cross-field swap risk is concrete in option-edit forms. Brand PollTitle and PollOptionLabel as separate phantom brands.

## Summary of Changes

Defined PollTitle and PollOptionLabel brands in packages/types/src/value-types.ts and applied them to Poll.title and PollOption.label. Re-exported from packages/types/src/index.ts. Updated PollEncryptedInputSchema and the nested PollOptionSchema in packages/validation/src/poll.ts to use brandedString for both fields. Canonical chain inherits brands via existing Pick/Omit projections; the array projection of PollOption inside PollEncryptedInput propagates the option-label brand through Zod inference. Both fields previously required min(1); brandedString preserves that semantic via its length > 0 predicate.
