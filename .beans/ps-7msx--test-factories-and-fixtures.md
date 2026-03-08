---
# ps-7msx
title: Test factories and fixtures
status: todo
type: task
priority: high
created_at: 2026-03-08T13:37:01Z
updated_at: 2026-03-08T13:37:16Z
parent: ps-jvnm
blocked_by:
  - ps-6r0l
---

Shared test factories and fixtures for all domain entities

## Scope

- Evaluate: `@praha/drizzle-factory` (integrates with Drizzle schema, sequence for unique defaults, traits for variations)
- Factory functions for all domain entities:
  - createTestSystem(), createTestMember(), createTestFrontingSession(), createTestGroup(), createTestBucket(), createTestChannel(), createTestMessage(), etc.
- Randomized default values: UUIDs for IDs, faker-style for names (or simple random strings)
- UUID-based isolation: every test gets unique data
- Crypto test helpers: deterministic keys for reproducible tests (fixed seed → fixed keys)
- Database test helpers:
  - PGlite (WASM Postgres in-memory) for integration tests — no Docker needed
  - Transaction wrapping: each test runs in a rolled-back transaction
  - Schema push (not migrate) for speed in tests
- afterEach cleanup patterns: template for state reset

## Acceptance Criteria

- [ ] Factory library selected and configured
- [ ] Factory function for each M1 domain entity (at minimum: System, Member, FrontingSession, Group, Bucket)
- [ ] Randomized defaults (no hardcoded shared fixtures)
- [ ] Crypto test helpers with deterministic keys
- [ ] PGlite setup for DB integration tests
- [ ] Transaction-wrapping test helper
- [ ] afterEach cleanup template documented
- [ ] Example integration test using factories + PGlite

## Research Notes

- @praha/drizzle-factory: defineFactory with sequence, use() for relations, traits
- PGlite: WASM Postgres in-memory, eliminates Docker dependency
- Use push (not migrate) for speed in test setup

## References

- CLAUDE.md (Test Hygiene)
- CONTRIBUTING.md
