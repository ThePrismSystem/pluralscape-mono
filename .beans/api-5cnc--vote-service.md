---
# api-5cnc
title: Vote service
status: todo
type: task
priority: high
created_at: 2026-03-25T05:59:20Z
updated_at: 2026-03-25T05:59:20Z
parent: api-8lt2
blocked_by:
  - api-ho24
  - api-d0ej
---

apps/api/src/services/poll-vote.service.ts — Voters are polymorphic EntityReference<member|structure-entity>. Cast vote (cooperative enforcement: check existing votes per voter entity, respect maxVotesPerMember), list votes, abstain (optionId=null), veto (isVeto=true, requires allowVeto). Vote uniqueness per voter EntityReference. Tests: unit (enforcement logic, veto validation, abstain, multi-vote, member vs structure-entity voter) + integration. 85%+ coverage.
