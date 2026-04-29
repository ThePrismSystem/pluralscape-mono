---
# api-xol4
title: "Timer-config update.ts: collapse read-before-write into single UPDATE when scheduling fields absent"
status: scrapped
type: task
priority: normal
created_at: 2026-04-22T03:32:22Z
updated_at: 2026-04-29T00:03:40Z
parent: ps-cd6x
---

Split off from api-p6uu item #1. Needs load measurement before acting.

## Problem

`apps/api/src/services/timer-config/update.ts:71-100` issues a SELECT to fetch the current row before computing `nextCheckInAt`, then a separate UPDATE. When the update payload includes no scheduling fields (enabled/intervalMinutes/wakingHoursOnly/wakingStart/wakingEnd), this SELECT is pure overhead.

## Scope

- Measure actual overhead of the extra SELECT under realistic load
- If non-trivial, skip the SELECT when scheduling fields are absent, collapsing to a single `UPDATE ... RETURNING`
- Preserve existing test coverage; add a test that asserts no SELECT is issued on non-scheduling updates

## Acceptance

- Fewer SQL roundtrips on the non-scheduling update path
- No regressions

## Reasons for Scrapping

The bean's premise was incorrect. Verified against `apps/api/src/services/timer-config/update.ts` (introduced in commit 7c063583 on 2026-04-22, the same day this bean was filed):

- The SELECT (lines 71-100) is already gated behind the scheduling-fields check (lines 63-69).
- When the update payload contains no scheduling fields, no SELECT is issued — only the single UPDATE on lines 102-115.
- The optimization the bean describes ("skip the SELECT when scheduling fields are absent") is already in place.

The remaining inefficiency — SELECT + UPDATE when scheduling fields _are_ present — is two round-trips inside a single transaction (sub-millisecond). Collapsing it would require either pushing `computeNextCheckInAt` (date math + waking-hours + timezone logic) into SQL or constructing a CTE, both of which add maintenance cost for negligible gain. Not worth pursuing.

The diagnostic SELECT inside `assertOccUpdated` only fires on OCC conflict, so it has no steady-state cost.
