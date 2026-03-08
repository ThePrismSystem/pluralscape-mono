---
# ps-jkpn
title: i18n framework setup
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:36:07Z
updated_at: 2026-03-08T13:36:15Z
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

- [ ] i18n framework installed and configured
- [ ] Translation file structure established (locales/en/\*.json)
- [ ] Namespace organization documented
- [ ] Example component using i18n (proof of concept)
- [ ] Missing key detection in dev mode
- [ ] Crowdin project setup documented (not necessarily created yet)
- [ ] All existing UI strings (if any) externalized

## References

- features.md section 11 (Internationalization)
