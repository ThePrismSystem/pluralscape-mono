---
# db-vnfk
title: Fix member_photos.sortOrder nullable mismatch
status: todo
type: bug
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-11T04:47:32Z
parent: db-2je4
---

nullable in DB but non-nullable in ServerMemberPhoto type. Add .notNull(). Ref: audit M22
