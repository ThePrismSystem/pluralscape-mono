---
# api-r1pi
title: Add structured logging with request ID correlation
status: todo
type: task
priority: high
created_at: 2026-03-18T20:09:01Z
updated_at: 2026-03-18T20:09:01Z
parent: api-mzn0
---

Replace all console.\* calls with Pino structured logger. Add request ID correlation via middleware. Thread request-scoped logger through context.

## TODO

- [ ] Add pino dependency to apps/api/package.json
- [ ] Create apps/api/src/lib/logger.ts with Pino config
- [ ] Replace console.warn/info in index.ts with logger
- [ ] Attach child logger with requestId in request-id middleware
- [ ] Replace console.error/warn in error-handler.ts with logger
- [ ] Replace console.error in auth.ts middleware with logger
- [ ] Replace console.warn in valkey-store.ts with logger
- [ ] Replace console.error in auth.service.ts with logger
- [ ] Replace console.error in recovery-key.service.ts with logger
- [ ] Replace console.warn in blob-s3-cleanup.ts with logger
- [ ] Add unit tests for logger module
- [ ] Update middleware tests for structured log output
- [ ] Rebase onto main after PR1 merges
- [ ] Verify: pnpm typecheck && pnpm lint && pnpm vitest run --project api
