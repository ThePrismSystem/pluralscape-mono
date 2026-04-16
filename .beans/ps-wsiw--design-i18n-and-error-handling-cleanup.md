---
# ps-wsiw
title: Design, i18n, and error handling cleanup
status: completed
type: task
priority: low
created_at: 2026-04-16T06:59:12Z
updated_at: 2026-04-16T12:33:32Z
parent: ps-0enb
---

Low-severity design, i18n, and error handling findings from comprehensive audit.

## Findings

- [ ] [EMAIL-D-L1] validateSendParams throws InvalidRecipientError for over-limit recipients
- [ ] [EMAIL-D-L2] validateSendParams throws EmailDeliveryError for subject length
- [ ] [I18N-D-L1] createI18nInstance() with no arguments throws at init time
- [ ] [I18N-D-L2] pluralizeHeuristic does not handle "th" endings
- [ ] [I18N-D-L3] resolveTermTitle does not lowercase non-first letters
- [ ] [I18N-T-L1] nomenclature.ts contains "Alter"/"Alters" in PRESET_PLURAL_RULES
- [ ] [STORAGE-S-L1] Quota TOCTOU acknowledged but not enforced
- [ ] [STORAGE-S-L2] getMetadata silently swallows parse errors on sidecar JSON

## Summary of Changes

Fixed PR #458 review issues:

- Fixed dead else branch in createI18nInstance branching logic — now throws when missingKeyMode is 'warn' without a logger
- Fixed stale JSDoc default in I18nConfig (warn → throw)
- Fixed i18n tests to explicitly pass missingKeyMode: 'warn' and added behavioral tests for throw mode default and warn-without-logger
- Added structured fields (field, actual, max) to EmailValidationError with tests
- Added reserveQuota boundary test in quota-service
