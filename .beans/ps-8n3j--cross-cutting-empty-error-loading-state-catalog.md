---
# ps-8n3j
title: "Cross-cutting: Empty / error / loading state catalog"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:51:15Z
updated_at: 2026-05-17T07:42:03Z
parent: ps-k8mz
blocked_by:
  - ps-5920
---

## Goal

Produce a catalog screen showing every canonical empty / error / loading variant used across the app, so Phase 3 state-coverage audit has a reference.

## Surfaces

- Empty-list variants (first-time empty, search-no-results, filter-no-results, offline-empty).
- Loading variants (skeleton list, skeleton card, spinner full-screen, inline spinner).
- Error variants (network, server 5xx, permission 403, not-found 404, conflict 409, validation 422).
- Maintenance / forced-upgrade states (linked from ps-\* system-banners bean).

## Required states per surface

- N/A — this bean IS the state catalog.

## Mode notes

- Default mode only.
- All other modes will reference this catalog in their Phase 3 sweep.

## Primitives required

- Card primitive.
- Skeleton primitive.
- Spinner primitive.
- Icon (per state).

## Data refs (informational)

- N/A — UI catalog only.

## Required output

- HTML mockup with every variant labeled in docs/design-system/preview/cross-cutting/state-catalog.html.
- Decision notes: copy register per error class, illustration vs. icon choice per empty class.

## Out of scope

- RN implementation (M11).
- Per-screen error mapping (lives in each screen bean).
