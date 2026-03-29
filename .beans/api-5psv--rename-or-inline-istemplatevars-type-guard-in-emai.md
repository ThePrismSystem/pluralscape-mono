---
# api-5psv
title: Rename or inline isTemplateVars type guard in email-worker
status: completed
type: task
priority: low
created_at: 2026-03-29T07:13:17Z
updated_at: 2026-03-29T12:48:11Z
parent: api-kjyg
---

email-worker.ts:16-21 isTemplateVars returns true for any object. Name suggests structural validation but only checks typeof === 'object' && !== null. Rename to assertSerializedVars or inline with explanatory comment.
