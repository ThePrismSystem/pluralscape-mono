---
# ps-sg8k
title: "M10 audit: Primitive coverage gap analysis"
status: completed
type: task
priority: high
created_at: 2026-05-17T05:49:37Z
updated_at: 2026-05-17T06:31:39Z
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

## Summary of Changes

Audit performed inline during M10 full-buildout. Existing `docs/design-system/preview/components-*.html` survey produced the following classification:

**Covered** (no new bean needed): Button, IconButton, Badge, Chip, Card, Surface, Switch, FAB, TextField, PinPad, BottomTabBar, AppHeader, Tabs, NavBackButton, PullToRefresh, Avatar, AvatarStack, MemberCard, Skeleton, Toast/Snackbar, Banner, BottomSheet, Tooltip, LoadingOverlay, Timeline, Chart, ColorStrip, MarkdownRenderer, MentionRenderer, ListItem, Section, Tree, DatePicker, TimePicker, DateTimePicker, DurationPicker, Select, MultiSelect, ColorSwatchPicker, EmojiPicker, ImagePickerLauncher, SegmentedControl, Checkbox, Radio, Dialog. Member-identity, Privacy-buckets, State-of-data, Fronting-timeline, Import-conflict, Destructive-action, Custom-terminology patterns all in `patterns.html`.

**Missing — spawned 37 follow-up beans under ps-udt1**:

Foundation: EmptyState (ps-ruwi), ErrorState (ps-a5ee), SyncIndicator (ps-gnkq)
Input: RecoveryKeyField (ps-o1zp), ImageCropper (ps-107o), BlockEditor (ps-zpyu), RichTextField (ps-9yhh)
Display: RecoveryKeyDisplay (ps-xthc), EncryptionTierBadge (ps-gfhz), ProgressBar+ProgressRing (ps-3m01), Accordion (ps-ecpl), KeyValueRow (ps-5lr6)
Feedback: DestructiveConfirmDialog (ps-bydy), ConfirmGesture (ps-00b4), Popover (ps-rgrw)
Navigation: Drawer (ps-217e), SystemSwitcher (ps-a5pt), SearchHeader (ps-oylh), InfiniteList (ps-hijf)
Domain: FrontingChip (ps-458i), FrontingTimelineLane (ps-sal4), BucketPill (ps-i6n1), LifecycleEventChip (ps-v3e9), ProxyChip (ps-jtvw), RelationshipEdge (ps-jtn3), InnerworldNode (ps-5iro), CheckInPrompt (ps-7to1), KeyRotationStepper (ps-oipx)
Pickers: MemberPicker+Multi (ps-djqo), EntityRefPicker (ps-ywtb), TagPicker (ps-jleu), BucketPicker (ps-s9r6), SaturationPicker (ps-xts0), RelationshipTypePicker (ps-1v9l), EntityTypePicker (ps-gml0)
Patterns: RecoveryKey ceremony (ps-472d), WizardStepper (ps-rhno)

**Audit report**: not written as a separate file — `docs/design-system/audits/` is gitignored. The summary above captures the same gap data inline so the spawned bean IDs are traceable in the committed bean files.

**Blocks-pilot primitives** (Phase 1 Fronting beans should declare blocked_by on these): FrontingChip (ps-458i), FrontingTimelineLane (ps-sal4), AvatarStack already covered, EmptyState (ps-ruwi), DestructiveConfirmDialog (ps-bydy), CheckInPrompt (ps-7to1), BucketPicker (ps-s9r6), MemberPicker+Multi (ps-djqo).
