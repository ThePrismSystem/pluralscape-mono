---
# api-iju9
title: Refactor structure-membership service to eliminate duplication
status: completed
type: task
priority: high
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:39:45Z
parent: api-i2pw
---

591-line file with three near-identical add/remove/list function trios for subsystem, side-system, and layer memberships. Extract generic addMembership<T>, removeMembership<T>, listMemberships<T>. Could reduce by ~60%. Ref: audit P-2.

## Summary of Changes\n\nRefactored structure-membership.service.ts from 592 to ~290 lines (~51% reduction). Extracted generic addMembershipGeneric(), removeMembershipGeneric(), and listMembershipsGeneric() functions parameterized by MembershipEntityConfig. Converted 9 public functions to thin wrappers. Extended ENTITY_CONFIGS to include table and field references.
