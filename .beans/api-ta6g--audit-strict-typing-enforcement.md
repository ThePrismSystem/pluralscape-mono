---
# api-ta6g
title: "Audit: strict typing enforcement"
status: completed
type: task
priority: normal
created_at: 2026-03-30T21:11:19Z
updated_at: 2026-03-31T01:26:38Z
parent: api-e7gt
---

Audit for proper strict typing: eliminate any remaining 'as any', loose type assertions, missing return types, untyped parameters, and ensure full type safety throughout.

## Summary of Changes

Fixed 12 catch blocks with untyped error parameters across services, jobs, and lib files. Changed `catch (error)` to `catch (error: unknown)` for strict typing consistency.

All other typing patterns were already clean:

- Zero `as any` casts
- Zero `@ts-ignore` / `@ts-expect-error` directives
- Type assertions (e.g., `as AccountId`) are all legitimate narrowing from DB row types
