---
# ps-vwn0
title: Consolidate E2E test apps under unified naming or directory structure
status: todo
type: task
priority: low
created_at: 2026-04-16T18:22:17Z
updated_at: 2026-04-16T18:22:17Z
parent: ps-9u4w
---

Today the monorepo has E2E test packages as siblings under apps/ following the <app>-e2e convention (apps/api-e2e/). When mobile-shr0 lands, this will grow to two (apps/api-e2e/, apps/mobile-web-e2e/), and a future native E2E suite would add apps/mobile-native-e2e/. As the count grows, a flatter or more grouped convention becomes valuable.

## Options to consider

- **(1) Prefix convention**: rename to e2e-api/, e2e-mobile-web/, e2e-mobile-native/. All E2E packages sort together alphabetically under apps/. Minimal structural change.
- **(2) Nested directory**: move to apps/e2e/api/, apps/e2e/mobile-web/, apps/e2e/mobile-native/. Stronger visual grouping; requires pnpm workspace glob update.
- **(3) Top-level e2e/ directory**: move out of apps/ entirely to a sibling e2e/ directory: e2e/api/, e2e/mobile-web/. Clearest separation; largest workspace + tsconfig + CI ripple.

## Cost (mechanical scope)

- Rename / move package directories.
- Update pnpm-workspace.yaml globs.
- Update root package.json workspaces if relevant (current setup uses pnpm workspaces).
- Update CI job paths in .github/workflows/ (every E2E job needs path adjustment).
- Update /verify slash-command and verify skill if they reference E2E paths or package names.
- Update pnpm filter targets in scripts (e.g. pnpm --filter @pluralscape/api-e2e ...).
- Update tsconfig project references if any cross-reference E2E packages.
- Update import paths in any code that references E2E test fixtures.
- Update docs (CONTRIBUTING.md, CLAUDE.md, README.md) where E2E paths are mentioned.
- Run /verify to confirm nothing breaks.

## Decision criteria

- Worth doing once we have ≥3 E2E packages.
- Defer until the unified convention has a clear winner — no need to rename twice.
- Bundle with another monorepo restructure if one is happening anyway.

## Acceptance

- Naming convention chosen and documented (option 1, 2, or 3).
- All E2E packages renamed/moved consistently.
- pnpm workspaces, CI jobs, /verify, and docs all reference the new paths.
- /verify passes end-to-end.

## Background

Surfaced during mobile-shr0 brainstorming when adding the second E2E package. The first new package follows the existing <app>-e2e pattern (mobile-web-e2e) to avoid blocking on this decision; rename happens in this bean.
