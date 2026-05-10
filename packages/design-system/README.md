# @pluralscape/design-system

The Inner Horizons design system: typed tokens, RN atoms, brand assets, and the binding specs that govern Pluralscape's mobile, web, and marketing surfaces.

## Public API

```ts
import {
  ThemeProvider,
  useTheme,
  useThemeMode,
  themes,
  type Theme,
  type ThemeMode,
  type ThemeProviderProps,
  Avatar,
  type AvatarProps,
  Badge,
  type BadgeProps,
  Button,
  type ButtonProps,
  Icon,
  type IconName,
  type IconProps,
  IconButton,
  type IconButtonProps,
  Input,
  type InputProps,
  PluralscapeLogo,
  type PluralscapeLogoProps,
  Switch,
  type SwitchProps,
} from "@pluralscape/design-system";
```

Atoms read tokens via `useTheme()`. Components never branch on mode — they read the resolved tokens for the active theme and render.

## Source of truth

- **Tokens:** `tokens/*.json`. Edit JSON, then run `pnpm tokens:build` to regenerate `src/tokens.generated.ts` and `src/themes.generated.ts`. Both generated files are committed.
- **Atom visual fidelity:** `docs/design-system/preview/components-*.html` (gitignored bundle — request it if missing).
- **Governance, cross-platform parity, accessibility:** `packages/design-system/docs/`.

## Themes

Five fully-merged themes ship today:

| Mode             | Purpose                                                    |
| ---------------- | ---------------------------------------------------------- |
| `default`        | Inner Horizons aesthetic — gradients, ambient motion, glow |
| `static`         | Strictest sensory accommodation — flat fills, motion off   |
| `reduced-motion` | Vestibular accommodation — visuals untouched, motion ≤50ms |
| `high-contrast`  | Brighter text, stronger borders, no surface tint           |
| `littles`        | Littles Safe Mode — softer accent, larger targets          |

`ThemeProvider` accepts `mode` and `onModeChange` props. Persistence is the consumer's job — wired in M10. The full mode contracts live in `docs/GOVERNANCE.md` §3.

## Package boundaries

- ≤150 LOC per atom (ESLint enforced via the `loc-ceilings` rule).
- No inline color, spacing, radius, motion, or elevation literals — every semantic value flows through `useTheme()`.
- Atoms compose tokens; tokens never reach into atoms.

## Tooling

| Script                                                  | Purpose                                                          |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| `pnpm --filter @pluralscape/design-system tokens:build` | Regenerate `src/tokens.generated.ts` + `src/themes.generated.ts` |
| `pnpm --filter @pluralscape/design-system tokens:check` | Validate tokens (forbidden-pair check) without writing outputs   |
| `pnpm --filter @pluralscape/design-system typecheck`    | TypeScript type-check                                            |
| `pnpm --filter @pluralscape/design-system lint`         | ESLint (zero warnings enforced)                                  |

Tests run from the repo root: `pnpm vitest run --project design-system`.
