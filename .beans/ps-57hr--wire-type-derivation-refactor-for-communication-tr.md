---
# ps-57hr
title: Wire type derivation refactor for communication transforms
status: completed
type: task
priority: normal
created_at: 2026-04-03T22:53:06Z
updated_at: 2026-04-04T05:00:40Z
parent: ps-21ff
---

Derive XxxRaw wire types from canonical domain types using Omit + encryptedData extension instead of manual redeclaration. Covers all 6 communication transforms in packages/data/src/transforms/.

## Summary of Changes

Replaced all manual `interface XxxRaw` declarations and `RouterOutput` type aliases with types derived from canonical domain types using `Omit + encryptedData` pattern across 14 transform files. Exported raw and page types from transforms. Updated all 20 hook files to import wire types from transforms instead of re-deriving from RouterOutput. System settings and CheckInRecord excluded (full-object encryption / no encryption respectively).
