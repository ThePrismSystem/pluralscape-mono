# Pluralscape design tokens

This folder is the **single source of truth** for Pluralscape design tokens. The Apr 2026 audit flagged token drift across `colors_and_type.css`, the preview HTML, `theme.js`, inline JSX, and per-package CSS — this directory replaces the "edit it everywhere" workflow with one JSON tree and a build script.

## Layout

```
tokens/
  breakpoints.json   Responsive breakpoints (sm/md/lg/xl) consumed by responsive scales
  build.mjs          Style Dictionary build — emits tokens.generated.ts + themes.generated.ts
  colors.json        Primary / extended palette + semantic mapping + per-mode overrides
  elevation.json     Shadows + glow (default disables glow under static + high-contrast)
  gradients.json     Hand-painted aurora variants + grain overlay
  illustration.json  Illustration vocabulary (constellations, drift, atmospheric SVG)
  motion.json        Easing + duration scale + per-mode overrides
  pairings.json      Allowed / forbidden fg+bg pair registry — drives the contrast gate
  radii.json         Radius scale
  README.md          This file
  spacing.json       Spacing scale + touch-target floors per mode
  typography.json    Font stacks + type scale + responsive overrides + mode overrides
```

## Modes

`colors.json`, `typography.json`, `spacing.json`, `motion.json`, `elevation.json`, and `gradients.json` each define a default and a set of overrides under `modes.*`. The active modes are:

| Mode             | Selector                       | Purpose                                                            |
| ---------------- | ------------------------------ | ------------------------------------------------------------------ |
| Default          | (none)                         | Inner Horizons aesthetic                                           |
| `static`         | `[data-mode="static"]`         | Flat fills, no glow, motion clamped to 0                           |
| `reduced-motion` | `[data-mode="reduced-motion"]` | Visuals untouched, every duration ≤50ms (vestibular accommodation) |
| `high-contrast`  | `[data-mode="high-contrast"]`  | Brighter text, stronger borders, no surface tint                   |
| `littles`        | `[data-mode="littles"]`        | Littles Safe Mode — softer accent, no Crimson, ≥56×56 hit targets  |

Each override **merges** onto the default. Anything not listed inherits.

The `static` and `reduced-motion` modes used to be one mode called `low-sensory`. They are now separate — vestibular sensitivity (motion) is independent from broader sensory load (gradients, glow, atmosphere). The `gradients.json` `low-sensory` block is the last stale reference to that name and is on the cleanup queue.

## Generating downstream artifacts

The build script (`pnpm tokens:build`, which runs `node tokens/build.mjs` under [Style Dictionary](https://amzn.github.io/style-dictionary/)) produces both production and preview outputs:

- `src/tokens.generated.ts` — type-safe primitive scales (production source)
- `src/themes.generated.ts` — fully-merged theme objects per mode (production source)
- `docs/design-system/preview/colors_and_type.generated.css` — CSS custom properties + `[data-mode]` overrides (preview only)
- `docs/design-system/ui_kits/mobile/theme.generated.js` — `window.PS_THEME` + `applyMode(name)` helper (preview only)

The preview outputs land in the gitignored `docs/design-system/` bundle. The two `*.generated.ts` files are committed and consumed by the Atom layer.

A pairings validator runs first and short-circuits the build if any forbidden pair is reachable through `semantic.<mode>`. A forbidden pair never reaches downstream consumers, even if Vitest hasn't run.

The rule:

> **Edit JSON first, then run `pnpm tokens:build`.** Generated files carry a `/* DO NOT EDIT — regenerate from /tokens */` banner; reviewers can flag direct edits.

## What does not belong here

- **Component-level rules.** Buttons, switches, cards compose tokens — they don't define new ones. If you need a value the tokens don't have, add it here first.
- **One-off colors.** Avoid alpha-blended overlays as new tokens. Use existing primaries with documented opacity in component code.
- **Per-page tweaks.** Preview pages and screens reference tokens; they never override them.
