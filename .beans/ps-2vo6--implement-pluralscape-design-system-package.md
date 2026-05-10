---
# ps-2vo6
title: Implement Pluralscape design system package
status: in-progress
type: feature
priority: normal
created_at: 2026-05-10T08:22:37Z
updated_at: 2026-05-10T09:26:36Z
---

Stand up packages/design-system per spec docs/superpowers/specs/2026-05-10-design-system-package-design.md.

Plan: docs/superpowers/plans/2026-05-10-design-system-package.md

Sub-tasks (26 from plan):

## Phase 1: Bundle ingestion & gitignore

- [x] T1 Stage bundle reference at docs/design-system/ (gitignored)
- [x] T2 Move binding spec docs into packages/design-system/docs/

## Phase 2: Package skeleton

- [x] T3 Create package.json, tsconfig.json, eslint.config.js
- [x] T4 Write README.md and gitignored CLAUDE.md

## Phase 3: Tokens & assets ingestion

- [x] T5 Copy token JSON, fonts, logos from bundle
- [x] T6 Extend tokens/build.mjs to emit tokens.generated.ts and themes.generated.ts

## Phase 4: theme.ts wrapper

- [x] T7 Implement theme.ts (ThemeProvider, useTheme, useThemeMode) and tests

## Phase 5: Atom port (TDD per atom)

- [x] T8 Icon (lucide-react-native wrapper)
- [x] T9 Button
- [x] T10 IconButton
- [x] T11 Badge
- [x] T12 Avatar
- [x] T13 Input
- [x] T14 Switch
- [ ] T15 PluralscapeLogo

## Phase 6: Public API barrel & ESLint

- [ ] T16 src/index.ts barrel
- [ ] T17 ESLint max-lines:150 block + loc-ceilings.md update

## Phase 7: Workspace catalog + mobile integration

- [x] T18 Add lucide-react-native + react-native-svg to catalog (advanced earlier — pre-commit unblocker)
- [ ] T19 Wire apps/mobile (ThemeProvider, fonts, logo re-export)
- [ ] T20 Build smoke screen
- [ ] T21 Manual smoke verification on iOS/Android/web

## Phase 8: Skill, root CLAUDE.md, ui-design cleanup

- [ ] T22 Write design-pluralscape-screen skill
- [ ] T23 Update root CLAUDE.md project map
- [ ] T24 Delete ui-design/ and sweep references

## Phase 9: Final verification & wrap-up

- [ ] T25 Run full /verify suite
- [ ] T26 Push branch and open PR

Branch: feat/implement-design-system
