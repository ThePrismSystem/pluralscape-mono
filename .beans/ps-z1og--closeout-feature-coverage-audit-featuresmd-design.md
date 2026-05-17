---
# ps-z1og
title: "Closeout: Feature coverage audit — features.md ↔ design coverage"
status: todo
type: task
created_at: 2026-05-17T06:53:15Z
updated_at: 2026-05-17T06:53:15Z
parent: ps-l9fv
blocked_by:
  - ps-oqs8
---

## Goal

Verify every entry in docs/planning/features.md has design coverage somewhere in docs/design-system/preview/. Last gate before M10 closeout.

## Method

1. Parse docs/planning/features.md into an enumerated feature list.
2. For each feature, locate the designed surface(s) in docs/design-system/preview/ plus the owning bean.
3. Produce a coverage matrix: rows = features, columns = "designed surface" + "owning bean".
4. For every uncovered feature, create a follow-up bean parented to the most-relevant Phase 2 domain epic.

## Required output

- Audit report at docs/superpowers/audits/2026-XX-XX-feature-coverage.md.
- This bean's `## Summary of Changes` includes the matrix + spawned bean IDs.
- If zero gaps: explicit statement "100% feature coverage, no gaps."

## Out of scope

- Implementation work — gaps spawn beans only.
- M11 handoff doc (ps-\* sibling bean).
