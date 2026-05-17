---
# ps-eifq
title: "Settings: Accessibility + Language picker"
status: todo
type: feature
created_at: 2026-05-17T06:46:13Z
updated_at: 2026-05-17T06:46:13Z
parent: ps-6a3x
---

## Goal

Design the accessibility settings (font-scale recap + system-level overrides for color contrast / motion / haptics) and the language picker (locale + per-system terminology). Bundled because both are localization / accommodation concerns.

## Surfaces

- Accessibility: `(app)/settings/accessibility.tsx`
- Language: `(app)/settings/language.tsx`

## Required states per surface

- accessibility: default with toggles (reduce-motion, increase-contrast, haptics, screen-reader hints), each with-OS-override-detected indicator, with-reset
- language: idle (current locale highlighted), pick with-preview, with-RTL-warning if RTL locale picked, submitting

## Mode notes

- Littles: settings show fewer toggles
- High-contrast: this screen itself must look correct under all modes (eat your own dog food)

## Primitives required

- ScreenScaffold, Switch, RadioGroup (locale), KeyValueRow (ps-5lr6), Banner (OS override), Button (reset), Card (preview tile)

## Data refs (informational)

- Local app settings (synced to system.settings)
- `apps/api/src/trpc/routers/system.ts` settings.locale

## Required output

- [ ] docs/design-system/preview/settings-accessibility-language.html with both surfaces + states
- [ ] Rationale on the OS-override-detected affordance (banner vs inline)

## Out of scope

- RN code (M11), data wiring (M12), the i18n implementation (already exists in `packages/i18n`)
