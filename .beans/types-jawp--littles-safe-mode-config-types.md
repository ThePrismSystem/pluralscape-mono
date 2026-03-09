---
# types-jawp
title: Littles Safe Mode config types
status: completed
type: task
priority: normal
created_at: 2026-03-08T14:24:18Z
updated_at: 2026-03-09T06:29:52Z
parent: types-im7i
blocked_by:
  - types-av6x
---

Configuration and content types for Littles Safe Mode simplified UI.

## Scope

- `LittlesSafeModeConfig`: enabled (boolean), allowedContentIds (string[]), simplifiedUIFlags (SafeModeUIFlags)
- `SafeModeUIFlags`: largeButtons (boolean), iconDriven (boolean), noDeletion (boolean), noSettings (boolean), noAnalytics (boolean)
- `SafeModeContentItem`: id, systemId, contentType ('link'|'video'|'media'), url (string | null), blobRef (BlobId | null), title (string), description (string), sortOrder (number)

## Acceptance Criteria

- [ ] Config type with enable flag and UI simplification flags
- [ ] Content item type for links, videos, and media
- [ ] Sort order for content display
- [ ] Unit tests for config validation

## References

- features.md section 13 (Littles Safe Mode)

## Summary of Changes

Created littles-safe-mode.ts with SafeModeUIFlags (largeButtons, iconDriven, noDeletion, noSettings, noAnalytics), SafeModeContentItem (id, systemId, contentType, url, blobRef, title, description, sortOrder), and LittlesSafeModeConfig (enabled, allowedContentIds, simplifiedUIFlags). Branch: feat/types-settings-and-config.
