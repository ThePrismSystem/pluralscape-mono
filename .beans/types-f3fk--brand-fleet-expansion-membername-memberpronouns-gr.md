---
# types-f3fk
title: "Brand fleet expansion: Member.name, Member.pronouns, Group.name, Channel.name"
status: todo
type: task
priority: normal
created_at: 2026-04-27T04:54:07Z
updated_at: 2026-04-27T21:27:05Z
parent: ps-cd6x
---

Per types-yxgc spec (2026-04-26): expand non-ID branded value types to fleet display labels. Pattern: define brands in packages/types/src/value-types.ts, apply to domain types, update Zod schemas to brandedString, brand at transform construction. Cross-link: docs/superpowers/specs/2026-04-26-m9a-closeout-design.md

## Audit fold-ins from types-t3tn (2026-04-27)

The types-t3tn audit doc (at docs/local-audits/2026-04-27-free-text-label-brand-audit.md, gitignored) folded these scope items into types-f3fk rather than filing separate beans:

**Direct fold-ins (when implementing types-f3fk, also brand these):**

- CustomFront.name — same display-label semantic as Member/Group/Channel.name
- Entity-display-names cluster: Bucket.name, SystemStructureEntity.name, SystemStructureEntityType.name, InnerWorldRegion.name, LandmarkEntity.name — same pattern as Member.name

**Design questions deferred to types-f3fk's implementation discussion:**

- EntityDescription cluster: Bucket.description, SystemStructureEntity.description, InnerWorldRegion.description (and Group.description, Channel.description, Member.description — already in scope) — single brand "EntityDescription" or per-entity?
- System.name vs displayName interaction
- NotificationPayload.title vs body (audit notes design tension; revisit if it lands)

Separately filed follow-ups (NOT folded; have their own beans):

- types-gkhk: Brand FieldDefinition.name as FieldDefinitionLabel
- types-e6n9: Brand Poll.title and PollOption.label
- types-cdr5: Brand Note.title and Note.content
- types-x37g: Brand JournalEntry.title and WikiPage.title
- types-09m5: Brand FrontingSession.comment / positionality / outtrigger
