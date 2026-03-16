---
# ps-jkpn
title: i18n framework setup
status: completed
type: task
priority: normal
created_at: 2026-03-08T13:36:07Z
updated_at: 2026-03-16T05:12:46Z
parent: ps-7z0s
---

i18n framework selection and initial setup

## Scope

- Framework evaluation: react-i18next (most mature), lingui (smaller bundle), FormatJS (ICU standard)
- Recommendation: react-i18next (largest ecosystem, Expo-compatible, well-maintained)
- Integration with Expo/React Native and web
- String externalization pattern: all UI strings in JSON translation files
- Namespace organization: one namespace per feature area (auth, members, fronting, settings, etc.)
- Build pipeline: missing key detection (warn on untranslated keys)
- Crowdin integration setup for community translations
- Default language: English (en)

## Acceptance Criteria

- [x] i18n framework installed and configured
- [x] Translation file structure established (locales/en/\*.json)
- [x] Namespace organization documented
- [x] Example component using i18n (proof of concept)
- [x] Missing key detection in dev mode
- [x] Crowdin project setup documented (not necessarily created yet)
- [x] All existing UI strings (if any) externalized

## References

- features.md section 11 (Internationalization)

## Summary of Changes

Created @pluralscape/i18n package with react-i18next integration:

- createI18nInstance() factory with configurable missing key handling (warn/throw)
- RTL text direction detection via isRtl()/getTextDirection()
- I18nProvider React component wrapping I18nextProvider
- Namespace organization: common, auth, members, fronting, settings, communication, groups, privacy, structure
- Translation JSON files in apps/mobile/locales/en/
- Mobile app \_layout.tsx wrapped with I18nProvider
- Home screen "Pluralscape" text uses t("appName") from common namespace
- 31 tests covering constants, instance creation, missing key handler, and text direction
