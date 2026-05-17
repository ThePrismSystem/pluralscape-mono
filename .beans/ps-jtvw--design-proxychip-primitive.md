---
# ps-jtvw
title: Design ProxyChip primitive
status: scrapped
type: task
priority: normal
created_at: 2026-05-17T06:29:24Z
updated_at: 2026-05-17T19:06:45Z
parent: ps-udt1
---

## Goal

Design the ProxyChip primitive: currently-selected proxy member shown in the chat composer. Tappable to open the rapid proxy-switch fly-out. Distinct from FrontingChip — ProxyChip reflects who-is-sending-this-message, not who-is-fronting.

## Required output

- [ ] `docs/design-system/preview/components-proxy-chip.html` showing variants (member proxy, custom-front proxy, structure-entity proxy, no-proxy-default) and required states (default, active, fly-out-open, error-cannot-resolve)
- [ ] Spec doc per SKILL.md §8 (visual disambiguation rule from FrontingChip; per-system terminology applies — "proxy" may be renamed via nomenclature settings)

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/typography.json`
- Reference: features.md §3 (proxy messaging), `apps/api/src/trpc/routers/message.ts`

## Out of scope

- RN code (M11), screen-level integration (Communication beans)

## Reasons for Scrapping

Re-audit round 2 (2026-05-17): ProxyChip is not needed. The PluralKit /
SimplyPlural proxy concept is data-import-time only — system members and
their identifying patterns surface in the existing MemberPicker and
mention flows. There is no surface in the M10 design scope where a
distinct "proxy" affordance is meaningful.

If a proxy-specific UI is ever required, the bean can be re-opened then.
