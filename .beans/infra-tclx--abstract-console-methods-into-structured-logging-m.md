---
# infra-tclx
title: Abstract console methods into structured logging module
status: completed
type: task
priority: normal
created_at: 2026-03-09T11:15:03Z
updated_at: 2026-03-21T11:13:51Z
parent: api-0zl4
---

Create a structured logging module that wraps console.info/warn/error. Then ban all direct console usage codebase-wide (remove info from the no-console allow list) except in the one logging module file.

## Tasks

- [ ] Create a logging module (e.g. `packages/logger/` or `apps/api/src/logger.ts`)
- [ ] Wrap console.info, console.warn, console.error with structured context (timestamps, service name, etc.)
- [ ] Replace all direct console usage with the logger
- [ ] Update ESLint no-console rule to ban all console methods (remove "info" from allow list)
- [ ] Add ESLint override for the logger file only to allow console usage there

## Summary of Changes\n\nVerified as already complete. Pino-based structured logger exists at `apps/api/src/lib/logger.ts`, Logger interface at `packages/types/src/logger.ts`, ESLint enforces `no-console: error` globally with overrides for test/bench/script files, and no production console calls exist outside test utilities.
