---
# ps-edgj
title: "Fix pattern deviations: wire type leakage and key aliasing"
status: completed
type: task
priority: normal
created_at: 2026-04-06T00:53:09Z
updated_at: 2026-04-06T08:21:13Z
parent: ps-y621
---

Two code pattern deviations from gold standard:

1. use-lifecycle-events.ts:96 — list select callback passes masterKey directly instead of aliasing const key = masterKey first. Breaks established pattern used in all other list transforms.

2. use-privacy-buckets.ts:30,57-59 and use-friend-connections.ts:33,59-63 — return union mixes local domain types with raw RouterOutput wire types. Every other domain uses clean type unions.

Audit ref: Pass 5 HIGH + MEDIUM

## Summary of Changes

Already fixed by M8 hook refactoring (PRs #383, #384). All three issues resolved:

1. use-lifecycle-events.ts — masterKey pattern removed, hooks use factories now
2. use-privacy-buckets.ts — returns DataQuery<PrivacyBucket|ArchivedPrivacyBucket>, wire types confined to internal generics
3. use-friend-connections.ts — same, returns clean domain type unions
