---
# mobile-1242
title: Measure mobile bundle impact of @pluralscape/import-sp subpath imports
status: todo
type: task
created_at: 2026-04-21T14:00:15Z
updated_at: 2026-04-21T14:00:15Z
parent: ps-8coo
---

Run expo export with source maps, quantify the bundle contribution of @pluralscape/import-sp subpath imports in the mobile bundle, and decide whether dynamic-import refactoring is warranted. Measurement-only task; implementation is conditional.

## Context

apps/mobile/src/features/import-sp/ statically imports from @pluralscape/import-sp/{engine,dependency-order,source-types,persister-types,avatar-fetcher-types}. Whether Metro tree-shakes workspace subpath imports is an empirical question — on paper the import-sp package is ~577 LOC in engine alone, plus the dependency-order graph. In a rarely-used flow (<1% of user sessions trigger an SP import), this is potentially dead weight on startup.

## Scope

- [ ] Run `pnpm --filter @pluralscape/mobile bundle -- --source-maps` (or equivalent expo export invocation) to produce a production-profile bundle
- [ ] Analyze the source-map output to quantify per-module size contribution from @pluralscape/import-sp subpaths
- [ ] Compare to baseline bundle size
- [ ] If import-sp contributes >50KB gzipped OR >200KB raw to the startup bundle, open a follow-up bean for dynamic-import refactoring of features/import-sp/\*
- [ ] If contribution is <50KB gzipped, close this bean with the measurement as the answer
- [ ] Document findings in docs/local-audits/2026-04-XX-mobile-bundle-import-sp.md

## Out of scope

- Actually refactoring to dynamic imports (conditional follow-up)
- Measuring other packages' contributions (separate concern)

## Acceptance

- Measurement report committed to docs/local-audits/
- Either: follow-up bean created for dynamic-import refactoring, or: this bean closed with explicit "no action warranted" rationale in Summary of Changes

## Notes

Parented to M12 Data Interpolation (ps-8coo) because that milestone already concerns bundle/performance work related to interpolated data imports.
