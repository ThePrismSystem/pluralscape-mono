---
# db-9mdk
title: Replace low-cardinality boolean indexes with composites
status: todo
type: task
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-11T19:40:19Z
parent: db-2nr7
---

acknowledgements (confirmed) ~50% selectivity — useless alone. members_archived_idx, sessions_revoked_idx same pattern. Replace with (system_id, confirmed), (system_id, archived), etc. Ref: audit M28, M29
