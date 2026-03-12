---
# db-2qv7
title: Right-size varchar(255) ID columns
status: completed
type: task
priority: low
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T10:17:43Z
parent: db-2nr7
---

All IDs use varchar(255). If UUIDs (36 chars), this wastes ~6x storage. Consider varchar(36), char(36), or native uuid type. At 9B message rows, this is ~180GB wasted in PKs and FK columns alone. All three models flagged this. Ref: audit L1

## Summary of Changes\n\nReplaced varchar(255) with varchar(50) via ID_MAX_LENGTH and ENUM_MAX_LENGTH constants across all 26 PG schema files. Updated PG test DDL helper to match. Columns storing hashes, salts, user text, locale, time strings, and checksums intentionally kept at varchar(255).
