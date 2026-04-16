---
# ps-wsiw
title: Design, i18n, and error handling cleanup
status: todo
type: task
priority: low
created_at: 2026-04-16T06:59:12Z
updated_at: 2026-04-16T06:59:12Z
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
