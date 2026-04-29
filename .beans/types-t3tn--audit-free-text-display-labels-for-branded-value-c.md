---
# types-t3tn
title: Audit free-text display labels for branded-value candidates (custom-front, custom-field, member-photo caption)
status: completed
type: task
priority: low
created_at: 2026-04-27T04:54:10Z
updated_at: 2026-04-29T09:39:41Z
parent: ps-cd6x
---

Per types-yxgc spec (2026-04-26): inventory remaining free-text fields across the domain (custom-front display name, custom-field labels, member-photo caption, board-message title, etc.) and decide per-field whether branding pays for itself. Cross-link: docs/superpowers/specs/2026-04-26-m9a-closeout-design.md

## Summary of Changes

Audit completed: 33 candidate fields surveyed across packages/types/src/entities/ outside the lifecycle-event scope (types-yxgc) and Member/Group/Channel name (types-f3fk).

Decisions: 5 brand candidates filed as follow-up beans (types-gkhk, types-e6n9, types-cdr5, types-x37g, types-09m5), 9 don't-brand singletons with one-line rationale, 3 deferred clusters (EntityDescription cluster, System.name vs displayName, NotificationPayload templating). Two clusters (CustomFront.name + the entity-display-names cluster) folded into types-f3fk's scope rather than filing separate beans, plus two design questions (EntityDescription strategy, System.name vs displayName) folded into types-f3fk for resolution before any description / system-name follow-ups are filed.
