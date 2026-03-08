---
# ps-mv06
title: Coverage configuration
status: todo
type: task
priority: high
created_at: 2026-03-08T13:36:44Z
updated_at: 2026-03-08T13:36:58Z
parent: ps-jvnm
blocked_by:
  - ps-6r0l
---

Coverage thresholds and CI enforcement

## Scope

- V8 coverage provider (AST-accurate in Vitest 3.2+, matches Istanbul)
- Coverage thresholds:
  - Unit: 80% lines
  - Integration: 70% lines
- Report formats: text (CLI), lcov (CI upload), html (local browsing)
- CI enforcement: fail on threshold violation
- Root-level coverage config (per Vitest 3 requirements)
- Aggregate coverage from root for local dev
- Per-package coverage with turbo caching + nyc merge for CI

## Acceptance Criteria

- [ ] V8 coverage provider configured
- [ ] Coverage thresholds set (80% unit, 70% integration)
- [ ] Text, lcov, and html reporters configured
- [ ] CI fails on threshold violation
- [ ] pnpm test:coverage script works
- [ ] Coverage report generated and viewable

## Research Notes

- V8 provider is now AST-accurate in Vitest 3.2+ (matches Istanbul quality)
- Coverage/reporters must be root-level configuration only

## References

- CLAUDE.md (Coverage targets)
- CONTRIBUTING.md
