---
# db-scah
title: Document PostgreSQL vs SQLite feature detection strategy
status: todo
type: task
priority: normal
created_at: 2026-03-09T12:13:41Z
updated_at: 2026-03-09T12:13:41Z
parent: db-2je4
---

Define which PostgreSQL features degrade or are absent on SQLite (RLS, JSONB operators, pgcrypto) and document the feature-detection strategy so API code doesn't become littered with dialect checks. Create a shared helper or capability object that each database adapter exposes.

Source: Architecture Audit 004, Metric 4
