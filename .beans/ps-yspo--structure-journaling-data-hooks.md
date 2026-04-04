---
# ps-yspo
title: Structure & journaling data hooks
status: todo
type: epic
priority: normal
created_at: 2026-03-31T23:12:51Z
updated_at: 2026-04-04T05:01:05Z
parent: ps-7j8n
---

System structure entities/links, journaling entries

## Transport

All hooks use tRPC via trpc.structure.\*, trpc.innerworld.\*, trpc.snapshot.\*.

## Hook Pattern Directives

When implementing data hooks for this epic, follow these standardized patterns:

### Wire types

- Derive `XxxRaw` from canonical domain type: `Omit<DomainType, keyof EncryptedFields | "archived"> & { encryptedData: string; archived: boolean; archivedAt: UnixMillis | null }`
- Do NOT use `RouterOutput` type aliases or manually redeclare raw interfaces
- Page types remain explicit: `{ data: readonly XxxRaw[]; nextCursor: string | null }`

### Hook patterns

- Wrap all `select` callbacks in `useCallback([masterKey])`
- Guard encrypted queries with `enabled: masterKey !== null`
- Subscription hooks must include `onError: () => {}` and accept `enabled?: boolean` option

### Testing

- Write render-level tests per hook file in `__tests__/`
- Use shared `renderHookWithProviders` helper from `apps/mobile/src/hooks/__tests__/helpers/`
- Create encrypted fixtures with `encryptXxxInput` helpers — do not mock transforms
- Cover: procedure args, select decryption, enabled guard, mutation cache invalidation
