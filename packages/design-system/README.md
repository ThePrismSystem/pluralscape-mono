# @pluralscape/design-system

The Inner Horizons design system: typed tokens, RN atoms, brand assets, and binding specs that govern Pluralscape's mobile, web, and marketing surfaces.

## Public API

```ts
import {
  ThemeProvider,
  useTheme,
  useThemeMode,
  themes,
  type Theme,
  type ThemeMode,
  Button,
  IconButton,
  Badge,
  Avatar,
  Input,
  Switch,
  Icon,
  PluralscapeLogo,
} from "@pluralscape/design-system";
```

Atoms read tokens via `useTheme()`. Components never branch on mode — they read resolved tokens.

## Source of truth

- **Tokens:** `tokens/*.json`. Edit JSON, then run `pnpm tokens:build` to regenerate `src/tokens.generated.ts` and `src/themes.generated.ts`.
- **Atom visual fidelity:** `docs/design-system/preview/components-*.html` (gitignored — request the bundle if missing).
- **Governance / cross-platform parity / accessibility:** `packages/design-system/docs/`.

## Themes

Four fully-merged themes ship: `default`, `low-sensory`, `high-contrast`, `littles`. `ThemeProvider` accepts `mode` + `onModeChange` props (persistence is the consumer's responsibility — wired in M10).

## Package boundaries

- ≤150 LOC per atom (ESLint enforced).
- No inline color, spacing, radius, motion, or elevation literals — all flow through `useTheme()`.
- Atoms compose tokens; tokens never reach into atoms.
