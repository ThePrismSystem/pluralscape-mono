---
# ps-2vo6
title: Implement Pluralscape design system package
status: in-progress
type: feature
priority: normal
created_at: 2026-05-10T08:22:37Z
updated_at: 2026-05-10T09:47:14Z
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
- [x] T15 PluralscapeLogo

## Phase 6: Public API barrel & ESLint

- [x] T16 src/index.ts barrel
- [x] T17 ESLint max-lines:150 block + loc-ceilings.md update

## Phase 7: Workspace catalog + mobile integration

- [x] T18 Add lucide-react-native + react-native-svg to catalog (advanced earlier — pre-commit unblocker)
- [x] T19 Wire apps/mobile (ThemeProvider, fonts, logo re-export)
- [x] T20 Build smoke screen
- [ ] T21 Manual smoke verification on iOS/Android/web

## Phase 8: Skill, root CLAUDE.md, ui-design cleanup

- [ ] T22 Write design-pluralscape-screen skill
- [ ] T23 Update root CLAUDE.md project map
- [ ] T24 Delete ui-design/ and sweep references

## Phase 9: Final verification & wrap-up

- [ ] T25 Run full /verify suite
- [ ] T26 Push branch and open PR

Branch: feat/implement-design-system

## Summary of Changes

T19 wires `apps/mobile` to consume `@pluralscape/design-system`:

- Add `@pluralscape/design-system` (workspace), `expo-font@~55.0.7`, `lucide-react-native` (catalog), and switch `react-native-svg` to catalog in `apps/mobile/package.json`.
- Create `apps/mobile/src/lib/fonts.ts` with `useDesignSystemFonts()` loading DM Sans (regular + italic) variable fonts via ESM imports of the design-system asset paths.
- Add `apps/mobile/src/types/assets.d.ts` ambient declarations for `*.ttf`/`*.otf`/`*.png` so the ESM asset imports type-check.
- Wrap the entire `apps/mobile/app/_layout.tsx` provider tree with `<ThemeProvider mode="default" onModeChange={noop}>`, including the loading/error early-return branches so all paths have theme context. Gate the entire return on `useDesignSystemFonts()` (returns `<LoadingSpinner />` until loaded). Mode persistence deferred to M10.
- Replace `apps/mobile/src/components/brand/PluralscapeLogo.tsx` (was 117 LOC inline SVG) with a thin re-export from `@pluralscape/design-system`. Existing import sites in mobile keep working.
- Extend `apps/mobile/app/__tests__/_layout.test.tsx` with mocks for `@pluralscape/design-system` (ThemeProvider as Fragment) and `../../src/lib/fonts.js` (useDesignSystemFonts → `[true]`), mirroring the existing `expo-secure-store`/`expo-router`/etc. mock pattern.

Verification:

- `pnpm --filter @pluralscape/mobile typecheck` exit 0.
- `pnpm --filter @pluralscape/mobile lint` exit 0.
- `pnpm vitest run --project mobile` 142 files / 1366 tests pass (up from 141/1357 baseline because the layout suite was previously failing at suite-level due to the new design-system import).

T20 builds the design-system smoke screen:

- Create `apps/mobile/src/screens/design-system-smoke.tsx` exercising every atom (Avatar, Badge, Button, Icon, IconButton, Input, PluralscapeLogo, Switch) plus a Mode section that switches between all 5 theme modes (`default`, `static`, `reduced-motion`, `high-contrast`, `littles`).
- Wraps content in a local `ThemeProvider` with internal `useState<ThemeMode>` so mode switching works inside the smoke screen even though the root layout wires `onModeChange={noop}` (mode persistence deferred to M10 per T19).
- All numeric layout values extracted to a top-level `LAYOUT` constants object; explicit `ReactElement` return types on all exports; alphabetized import groups with blank-line separation (mirrors T9/T13).
- Expose via `apps/mobile/app/(app)/design-system-smoke.tsx` route file that imports the screen from `src/screens/design-system-smoke.js`. Path: `/design-system-smoke` (under the authenticated `(app)` group; devs must be logged in to navigate). T21 will manually verify on iOS/Android/web.

Verification:

- `pnpm --filter @pluralscape/mobile typecheck` exit 0.
- `pnpm --filter @pluralscape/mobile lint` exit 0.
- `pnpm vitest run --project mobile` 142 files / 1366 tests pass (no test count change — smoke screen has no automated tests; T21 covers manual verification).
