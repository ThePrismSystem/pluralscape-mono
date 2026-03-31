---
# client-ensq
title: Pass timestamp query param on message single-entity API calls
status: todo
type: task
priority: normal
created_at: 2026-03-25T07:10:44Z
updated_at: 2026-03-31T23:13:01Z
parent: ps-21ff
---

Client-side work to populate the optional ?timestamp= query param when calling GET/PATCH/DELETE/archive/restore on message endpoints, enabling efficient partition pruning on the server.
