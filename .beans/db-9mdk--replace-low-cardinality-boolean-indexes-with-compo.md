---
# db-9mdk
title: Replace low-cardinality boolean indexes with composites
status: completed
type: task
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T07:21:36Z
parent: db-2nr7
---

acknowledgements (confirmed) ~50% selectivity — useless alone. members_archived_idx, sessions_revoked_idx same pattern. Replace with (system_id, confirmed), (system_id, archived), etc. Ref: audit M28, M29

## Summary of Changes\n\nDropped redundant `sessions_revoked_idx` (covered by composite `sessions_revoked_last_active_idx`). Replaced `acknowledgements_system_id_idx` + `acknowledgements_confirmed_idx` with composite `acknowledgements_system_id_confirmed_idx`.
