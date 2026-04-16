---
# types-4lvd
title: Update Member.colors to use HexColor branded type
status: completed
type: task
priority: normal
created_at: 2026-03-09T01:13:38Z
updated_at: 2026-04-16T07:29:41Z
parent: types-im7i
---

Follow-up from batch-2 review: Member.colors in identity.ts should be readonly HexColor[] for consistency.

## Summary of Changes

Updated Member.colors and MemberListItem.colors from `readonly string[]` to `readonly HexColor[]` in identity.ts. Branch: feat/types-settings-and-config.
