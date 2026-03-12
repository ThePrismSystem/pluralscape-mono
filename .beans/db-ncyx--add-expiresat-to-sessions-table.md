---
# db-ncyx
title: Add expiresAt to sessions table
status: completed
type: bug
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-12T03:06:53Z
parent: db-764i
---

sessions tracks lastActive and revoked but no expiresAt. No passive expiry mechanism. Stale session rows are a security liability (enumeration surface) and performance concern. Ref: audit H8

## Summary of Changes\n\nAdded nullable `expiresAt` column to sessions table (PG and SQLite) with index for automatic session expiration. Updated test helper DDL and added integration tests for null default and round-trip.
