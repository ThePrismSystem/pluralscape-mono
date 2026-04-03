---
# ps-57hr
title: Wire type derivation refactor for communication transforms
status: todo
type: task
created_at: 2026-04-03T22:53:06Z
updated_at: 2026-04-03T22:53:06Z
parent: ps-21ff
---

Derive XxxRaw wire types from canonical domain types using Omit + encryptedData extension instead of manual redeclaration. Covers all 6 communication transforms in packages/data/src/transforms/.
