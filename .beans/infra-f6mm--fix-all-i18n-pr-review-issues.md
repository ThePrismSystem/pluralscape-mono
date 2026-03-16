---
# infra-f6mm
title: Fix all i18n PR review issues
status: completed
type: task
priority: normal
created_at: 2026-03-16T05:50:36Z
updated_at: 2026-03-16T05:59:11Z
---

Fix 10 review issues from PR #134: sync init, type fixes, dead code removal, format-date separator, test infrastructure

## Summary of Changes\n\n- **types.ts**: Use `Locale` type from `@pluralscape/types`, remove dead `onMissingKey` callback, add `missingKeyMode` option\n- **create-i18n.ts**: Remove duplicated options from 3rdParty plugin, auto-set `saveMissing: true`\n- **I18nProvider.tsx**: Rewrite from async useState/useEffect to synchronous `useMemo` with `initAsync: false`\n- **\_layout.tsx**: Use `DEFAULT_LOCALE` constant instead of raw string literals\n- **format-date.ts**: Split `formatDateTime` into fixed-format (comma separator) and locale-aware (`Intl.DateTimeFormat`) paths\n- **format-number.ts**: Add clarifying comment for system locale branch\n- **vitest.config.ts**: Extract i18n to custom project config with .tsx support, node environment with per-file happy-dom\n- **I18nProvider.test.tsx**: New test file with 5 tests (sync render, translations, fallback, warn/throw modes)\n- **create-i18n.test.ts**: Updated for simplified factory (saveMissing auto-set, caller-controlled fallbackLng)
