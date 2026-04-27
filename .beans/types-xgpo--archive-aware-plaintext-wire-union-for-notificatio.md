---
# types-xgpo
title: Archive-aware plaintext wire union for NotificationConfig/FriendCode
status: scrapped
type: task
priority: normal
created_at: 2026-04-27T22:29:03Z
updated_at: 2026-04-27T22:29:35Z
---

Surfaced during PR #580 type-design review. NotificationConfigWire and FriendCodeWire flatten archive discriminant; should be a discriminated union via ArchivableWire<T> helper. See PR #580 review notes.

## Reasons for Scrapping

Accidental duplicate of types-0e9j. Same scope; only one bean needed.
