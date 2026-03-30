---
# api-85vl
title: Add groupId and search filters to member list endpoint
status: todo
type: task
priority: high
created_at: 2026-03-30T06:58:08Z
updated_at: 2026-03-30T06:58:08Z
parent: api-e7gt
---

Member list (GET /systems/:systemId/members) lacks groupId and search text query parameters. Client needs to filter members by group and search by name without fetching all members. Add groupId optional filter and search text filter to the list endpoint query schema and service.
