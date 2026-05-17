---
# ps-nypl
title: "Audit: State coverage — empty / loading / error across all surfaces"
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:52:27Z
updated_at: 2026-05-17T07:42:06Z
parent: ps-oqs8
blocked_by:
  - ps-nwju
  - ps-divy
  - ps-07l7
  - ps-5fc5
  - ps-9xue
  - ps-7wf6
  - ps-djgs
  - ps-6a3x
  - ps-k8mz
---

## Goal

Audit every list, grid, and detail surface for complete state coverage per the cross-cutting state catalog (ps-8n3j): every surface must designate one of each empty / loading / error variant.

## Method

1. Walk every HTML mockup under docs/design-system/preview/ produced by Phase 1 + Phase 2.
2. For each list / grid / detail screen, check:
   - Is the empty state designed? Which catalog variant?
   - Is the loading state designed? Skeleton vs. spinner?
   - Are the error states designed? Which catalog entries (network / 5xx / 403 / 404 / 409 / 422)?
3. For every surface missing a state, create a follow-up bean.

## Required output

- Audit report at docs/superpowers/audits/2026-XX-XX-state-coverage.md.
- Coverage matrix: rows = surfaces, columns = required states, cells = covered / spawned-bean-id.
- For each gap: a new bean titled "States: <surface>" parented to the relevant Phase 2 domain epic, blocked-by this audit bean.
- This bean's `## Summary of Changes` includes the matrix + spawned bean IDs.

## Out of scope

- Catalog itself (ps-8n3j).
- RN implementation (M11).
