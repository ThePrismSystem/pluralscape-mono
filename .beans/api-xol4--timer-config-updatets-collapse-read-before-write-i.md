---
# api-xol4
title: "Timer-config update.ts: collapse read-before-write into single UPDATE when scheduling fields absent"
status: todo
type: task
priority: normal
created_at: 2026-04-22T03:32:22Z
updated_at: 2026-04-27T20:28:57Z
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
