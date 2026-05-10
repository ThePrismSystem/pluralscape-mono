# Pluralscape design tokens

This folder is the **single source of truth** for Pluralscape design tokens. The PDF audit called out token drift across `colors_and_type.css`, the preview HTML, `theme.js`, inline JSX, and the per-package CSS — this directory replaces the "edit it everywhere" workflow.

## Layout

```
tokens/
  colors.json       Primary/extended palette + semantic mapping + mode overrides
  typography.json   Font stacks + type scale + responsive overrides + mode overrides
  spacing.json      Spacing scale + touch-target floors per mode
  radii.json        Radius scale
  motion.json       Easing + duration scale + mode overrides
  elevation.json    Shadows + glow (default disables glow under low-sensory + HC)
  README.md         This file
```

## Modes

`colors.json`, `typography.json`, `spacing.json`, `motion.json`, and `elevation.json` each define a default and a set of overrides under `modes.*`. The current modes are:

| Mode            | Selector                      | Purpose                                                       |
| --------------- | ----------------------------- | ------------------------------------------------------------- |
| Default         | (none)                        | Inner Horizons aesthetic                                      |
| `low-sensory`   | `[data-mode="low-sensory"]`   | Flat fills, no glow, motion clamped                           |
| `high-contrast` | `[data-mode="high-contrast"]` | Brighter text, stronger borders, no surface tint              |
| `littles`       | `[data-mode="littles"]`       | Littles Safe Mode — softer accent, no Crimson, larger targets |

Each override **merges** onto the default. Anything not listed inherits.

## Generating downstream artifacts

The build script (`node tokens/build.mjs` using [Style Dictionary](https://amzn.github.io/style-dictionary/)) generates production outputs:

- `src/tokens.generated.ts` (TypeScript type-safe token object)
- `src/themes.generated.ts` (theme objects for each mode)

Preview artifacts are still emitted to the gitignored bundle at `docs/design-system/` for development:

- `colors_and_type.css` (CSS custom properties + mode `[data-mode]` overrides)
- `ui_kits/mobile/theme.js` (`window.PS_THEME` + `applyMode(name)` helper)

The rule is:

> **Edit JSON first, then run `pnpm tokens:build`.** Production outputs carry a `/* DO NOT EDIT — regenerate from /tokens */` banner; reviewers can flag direct edits.

## What does not belong here

- **Component-level rules.** Buttons, switches, etc. compose tokens — they don't define new ones. If you reach for a value that doesn't exist in `tokens/`, add it here first.
- **One-off colors.** Avoid alpha-blended overlays as new tokens. Use existing primaries with documented opacity in component code.
- **Per-page tweaks.** Preview pages and screens reference tokens; they never override them.
