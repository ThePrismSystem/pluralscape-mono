---
# ps-2r3p
title: Refresh design-system package docs
status: completed
type: task
priority: normal
created_at: 2026-05-10T19:25:05Z
updated_at: 2026-05-10T19:31:49Z
---

Update design-system docs to reflect current state and add upcoming a11y CI gates.

## Scope

- README.md: align theme list with actual ThemeMode (default, static, reduced-motion, high-contrast, littles)
- tokens/README.md: complete file listing (breakpoints/gradients/illustration/pairings.json, build.mjs); refresh mode table to current names; correct build command
- docs/GOVERNANCE.md: small accuracy pass
- docs/cross-platform-parity.md: drop dead SKILL.md reference; point to GOVERNANCE.md §2; clarify font stack
- docs/A11Y_GATES.md: add planned gates (heading order, label association, focus trap, Esc-closes-overlays, lang attribute, image alts, duration ceilings per mode, autocomplete, error-message association, Reduced-motion coverage as its own row)

## Todo

- [x] README.md aligned with src/index.ts and ThemeMode
- [x] tokens/README.md layout matches tokens/ directory; mode table current
- [x] GOVERNANCE.md verified for accuracy and tone
- [x] cross-platform-parity.md verified for accuracy and tone
- [x] A11Y_GATES.md expanded with planned gates

## Summary of Changes

**README.md** — public API list expanded to include every export; theme list aligned with the actual `ThemeMode` (5 modes — `default`, `static`, `reduced-motion`, `high-contrast`, `littles`). Tooling table added.

**tokens/README.md** — layout block now lists every file (`breakpoints`, `gradients`, `illustration`, `pairings`, `build.mjs` were missing). Mode table now uses the current names; the `low-sensory` row is replaced by separate `static` and `reduced-motion` rows. Build command corrected to `pnpm tokens:build`. Notes both production and preview outputs.

**docs/GOVERNANCE.md** — small accuracy pass on §2: clarified that the package ships RN atoms plus HTML previews, not just HTML.

**docs/cross-platform-parity.md** — dropped the dead `SKILL.md` reference and pointed at `docs/GOVERNANCE.md` §2 instead. Type-ramp row corrected: package ships DM Sans Variable as the canonical face, with a fallback chain. Reduced-motion / high-contrast OS mappings spelled out per platform; explicit note that OS reduced-motion preference maps to `reduced-motion`, not `static`.

**docs/A11Y_GATES.md** — section A reorganized into five subsections (lint, token/contrast, component contract, motion/mode, render/document). New planned gates: per-mode contrast, touch-target spacing (2.5.8), focus trap, Esc-closes-overlays, form-label association, error-message association, autocomplete attribute (1.3.5), duration ceiling per mode, no-motion-only-signal, live-region etiquette, heading order (1.3.1), image alt-text, lang attribute, skip-to-content link, Lighthouse a11y score. Manual section gained a color-blindness simulation row.
