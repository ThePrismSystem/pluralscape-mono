---
# ps-sg8k
title: "M10 audit: Primitive coverage gap analysis"
status: todo
type: task
priority: high
created_at: 2026-05-17T05:49:37Z
updated_at: 2026-05-17T05:49:37Z
parent: ps-udt1
---

## Goal

Cross-reference every primitive named in docs/design-system/uploads/SCREENS.md §1.1–1.6 (foundations, inputs, display, feedback, navigation, domain primitives) and every primitive implied by docs/planning/features.md against existing preview HTML coverage in docs/design-system/preview/components-\*.html. Output a written gap list that drives the rest of Phase 0.

Spec: docs/superpowers/specs/2026-05-16-m10-bean-buildout-design.md

## Scope

Files surveyed:

- docs/design-system/preview/components-\*.html (existing coverage)
- docs/design-system/preview/brand-\*.html (brand-affected primitives)
- docs/design-system/uploads/SCREENS.md §1 (rough inventory, not contract)
- docs/planning/features.md (canonical feature spec)
- packages/design-system/src/components/ (already-ported atoms — out of scope unless a variant is missing)

## Pass criteria

- [ ] Every primitive named in SCREENS.md §1 classified as covered, partially covered, or missing.
- [ ] Every primitive implied by features.md (bucket pill, lifecycle event chip, fronting timeline lane, etc.) classified the same way.
- [ ] Composed patterns audited separately: member identity card, ConfirmDestructive tiers, ImportConflictResolver, SyncState, FrontingTimeline, RecoveryKey ceremony, PrivacyBucket primitive.
- [ ] Each gap classified by phase dependency: blocks-pilot (Phase 1 Fronting), blocks-domain (specific Phase 2 epic), or general-purpose.

## Required output

- [ ] Audit report: docs/design-system/audits/2026-05-XX-primitive-coverage.md
- [ ] One follow-up bean per missing primitive (parent ps-udt1)
- [ ] One follow-up bean per missing composed pattern (parent ps-udt1)
- [ ] Blocks-pilot primitives marked priority: high so Phase 1 Fronting beans can declare blocked_by on them

## Disposition of failures

Gaps spawn new beans referencing this audit. The audit bean completes when the report is written; follow-up bean creation and design work proceed independently.

## Out of scope

- Designing the primitives themselves (separate per-primitive beans).
- RN code (M11).
- Atoms already shipped in @pluralscape/design-system (Avatar, Badge, Button, Icon, IconButton, Input, Switch, PluralscapeLogo) unless a variant or state is missing.
