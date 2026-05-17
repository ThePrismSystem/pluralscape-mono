---
# ps-ywtb
title: Design EntityRefPicker primitive
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:30:23Z
updated_at: 2026-05-17T19:06:46Z
parent: ps-udt1
---

## Goal

Design the EntityRefPicker primitive: polymorphic picker returning an `EntityReference` discriminated union (member, custom-front, or structure-entity). Used wherever a fronting subject, comment target, or polymorphic entity must be chosen.

## Required output

- [ ] `docs/design-system/preview/components-entity-ref-picker.html` showing variants (segmented filter for kind, all-kinds search, kind-restricted) and required states
- [ ] Spec doc per SKILL.md §8 (visual disambiguation between the three entity kinds in result rows)

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/spacing.json`
- Reference: `EntityReference` type in `packages/types/`, features.md §2 (polymorphic subjects)

## Out of scope

- RN code (M11), screen-level integration (Phase 1 / 2)

## Entity-type scope (2026-05-17)

The canonical set of referenceable entities is
`BucketContentEntityType` from `packages/types/src/entities/bucket.ts`,
which currently lists 21 variants: member, group, channel, message, note,
poll, relationship, structure-entity-type, structure-entity,
journal-entry, wiki-page, custom-front, fronting-session, board-message,
acknowledgement, innerworld-entity, innerworld-region, field-definition,
field-value, member-photo, fronting-comment.

EntityRefPicker should NOT show all 21 by default — most surfaces only
need a subset. Expose a `scope` prop that takes a subset of
`BucketContentEntityType`:

- Mention insertion: ["member", "custom-front", "structure-entity"]
- Fronting reference: ["member", "custom-front", "structure-entity"]
- Journal entry tagging: ["member", "custom-front", "structure-entity",
  "group", "wiki-page", "journal-entry"]
- Privacy-bucket attachment: full set

Sectioned results in the picker should group by category (people,
content, structure). Custom systems may not have all 21 enabled —
filter the displayed set to what the system actually has data for.
