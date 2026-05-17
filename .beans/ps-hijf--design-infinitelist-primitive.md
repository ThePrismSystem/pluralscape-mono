---
# ps-hijf
title: Design InfiniteList primitive
status: todo
type: task
created_at: 2026-05-17T06:28:50Z
updated_at: 2026-05-17T06:28:50Z
parent: ps-udt1
---

## Goal

Design the InfiniteList primitive: cursor-paginated list with bottom-of-list loading sentinel and pull-to-refresh integration. Every list screen uses it. Coordinates with the tRPC cursor pattern. Provides empty / loading-initial / loading-tail / error / end-of-list states.

## Required output

- [ ] `docs/design-system/preview/components-infinite-list.html` showing variants (idle with items, loading-initial, loading-tail spinner row, end-of-list marker, error-at-tail) and required states
- [ ] Spec doc per SKILL.md §8 (cursor exhaustion behavior, retry-tail behavior, scroll-preservation on data update)

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/motion.json` (loading spinner)
- Reference: `apps/api/src/trpc/routers/*.ts` cursor pattern, existing `components-rows-tree.html`

## Out of scope

- RN code (M11), screen-level integration (Phase 1 / 2)
