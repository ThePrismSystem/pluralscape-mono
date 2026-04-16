---
# api-m3up
title: Structure-entity deletion must check note dependencies
status: todo
type: task
priority: normal
created_at: 2026-03-25T20:53:27Z
updated_at: 2026-04-16T06:49:51Z
parent: ps-0enb
---

When the structure-entity delete service is implemented, it must check for note dependencies before allowing deletion (same pattern as member.service.ts:577-592 where notes with authorEntityType='member' are counted). Without this check, deleting a structure-entity that authored notes would leave orphaned authorEntityId references in the notes table.
