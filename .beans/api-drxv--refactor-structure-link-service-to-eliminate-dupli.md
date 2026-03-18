---
# api-drxv
title: Refactor structure-link service to eliminate duplication
status: completed
type: task
priority: normal
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:40:44Z
parent: api-i2pw
---

499-line file with three near-identical create/delete/list function trios for subsystem-layer, subsystem-side-system, and side-system-layer links. Same pattern as structure-membership. Ref: audit P-4.

## Summary of Changes\n\nRefactored structure-link.service.ts from 500 to ~320 lines (~36% reduction). Extracted generic createLinkGeneric(), deleteLinkGeneric(), listLinksGeneric() functions parameterized by LinkEntityConfig. Converted 9 public functions to thin wrappers.
