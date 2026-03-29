---
# api-op7f
title: Add email worker integration test for happy path
status: completed
type: task
priority: high
created_at: 2026-03-29T07:11:28Z
updated_at: 2026-03-29T07:51:34Z
parent: api-kjyg
---

email-worker.integration.test.ts only tests two skip scenarios. The actual email-sending path through resolveAccountEmail -> renderTemplate -> adapter.send with a real database has zero integration coverage. Requires test account setup with encrypted email.

## Summary of Changes

Added 2 happy-path integration tests: email send with encrypted email and template variable rendering. Mocked EMAIL_ENCRYPTION_KEY env var to enable encryption round-trip. Also added createPgAuthTables call in beforeAll to set up the accounts schema (was missing from the original test, causing it to always fail in practice).
