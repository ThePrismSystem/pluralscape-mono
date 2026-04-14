---
# db-b5i4
title: Add RLS to sync_changes, sync_snapshots, sync_conflicts
status: todo
type: bug
priority: high
created_at: 2026-04-14T09:28:40Z
updated_at: 2026-04-14T09:28:40Z
---

AUDIT [DB-S-H1] These tables hold encrypted sync payloads but lack ENABLE ROW LEVEL SECURITY. Direct scan bypasses all isolation. RLS on sync_documents alone does not restrict reads on children.
