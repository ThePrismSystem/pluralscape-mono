---
# types-3ni9
title: i18n and locale types
status: completed
type: task
priority: normal
created_at: 2026-03-08T14:24:27Z
updated_at: 2026-03-09T06:05:14Z
parent: types-im7i
blocked_by:
  - types-av6x
---

Internationalization types for locale, translation, RTL support, and date/number formatting.

## Scope

- `Locale`: string branded type (BCP 47 tag, e.g., 'en-US', 'ja-JP')
- `TranslationKey`: string branded type for type-safe translation lookups
- `TranslationMap`: Record<TranslationKey, string>
- `TextDirection`: 'ltr' | 'rtl'
- `DateFormatPreference`: 'iso' | 'us' | 'eu' | 'relative'
- `NumberFormatPreference`: locale-specific number formatting options
- `LocaleConfig`: locale, textDirection, dateFormat, numberFormat

### Encryption tier annotations

- Locale and formatting preferences are T1 (stored in encrypted system settings)
- Server receives locale as T3 only when needed for server-generated content (see db-va9l)
- Translation keys and maps are not encrypted (shipped as app bundle assets)

## Acceptance Criteria

- [ ] Locale type with BCP 47 validation
- [ ] TranslationKey branded type for compile-time safety
- [ ] RTL support via TextDirection
- [ ] Date and number formatting preferences
- [ ] Encryption tier annotations documented
- [ ] Unit tests for locale utilities

## References

- features.md section 11 (Internationalization)

## Summary of Changes

Created i18n.ts with Locale (branded), TranslationKey (branded), TranslationMap, TextDirection, DateFormatPreference, NumberFormatPreference, LocaleConfig. Branch: feat/types-settings-and-config.
