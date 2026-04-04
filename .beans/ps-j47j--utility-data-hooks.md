---
# ps-j47j
title: Utility data hooks
status: todo
type: epic
priority: normal
created_at: 2026-03-31T23:12:54Z
updated_at: 2026-04-04T09:04:00Z
parent: ps-7j8n
---

Search, API key management, audit log, lifecycle events, media upload, account management (deletion, PIN, device transfer)

## Transport

All hooks use tRPC via trpc.system.search, trpc.apiKey.\*, trpc.lifecycleEvent.\*, trpc.blob.\*, trpc.account.\*.

**REST exception:** blob upload/download URL generation uses REST client for presigned URL handling.

## Hook Pattern Directives

When implementing data hooks for this epic, follow these standardized patterns:

### Wire types

- Derive `XxxRaw` from canonical domain type: `Omit<DomainType, keyof EncryptedFields | "archived"> & { encryptedData: string; archived: boolean; archivedAt: UnixMillis | null }`
- Do NOT use `RouterOutput` type aliases or manually redeclare raw interfaces
- Page types remain explicit: `{ data: readonly XxxRaw[]; nextCursor: string | null }`

### Hook patterns

- Wrap all `select` callbacks in `useCallback([masterKey])` for render stability
- Guard encrypted queries with `enabled: masterKey !== null`
- Unencrypted queries (e.g., analytics, checkInRecord) omit `enabled` and `select`
- Subscription hooks must include `onError: () => {}` and accept `enabled?: boolean` option
- Avoid no-op selectors — if the only difference is `readonly T[]` vs `T[]`, align the types instead of spreading

### Testing — React Query integration pattern

Tests must run hooks inside the real React lifecycle. Reference implementation: `use-members.test.tsx`.

**Infrastructure:**

- Use `renderHookWithProviders` from `apps/mobile/src/hooks/__tests__/helpers/` for ALL hook calls
- Mock tRPC to delegate to real React Query hooks via `vi.mock("@pluralscape/api-client/trpc", async () => { const rq = await import("@tanstack/react-query"); ... })`
- Seed fixture data via `vi.hoisted(() => new Map())` — accessible from the hoisted vi.mock factory
- Do NOT mock `useCallback`, `useMasterKey`, or `useActiveSystemId` — use real providers via the wrapper

**Query tests — assert on result.current.data:**

- `await waitFor(() => { expect(result.current.data).toBeDefined(); })` — braces required (no-confusing-void-expression)
- Assert on decrypted field values (name, description, etc.)
- Test `masterKey: null` via `renderHookWithProviders(() => hook(), { masterKey: null })` — expect `fetchStatus: "idle"`
- Test memoization: `rerender()` then `expect(result.current.data).toBe(ref1)` — same object reference proves `useCallback` stability

**Mutation tests:**

- `await act(async () => { result.current.mutate(input as never); })`
- `await waitFor(() => { expect(mockUtils.entity.invalidate).toHaveBeenCalledWith({...}); })`
- Use `() => Promise.resolve({})` for `mutationFn` (not `async () => ({})` — linter requires it)

**Subscription/analytics tests — hybrid pattern:**

- Keep option capture for `onData`/`onError` callbacks and `staleTime` (these are not React Query)
- Still wrap hook calls in `renderHookWithProviders` for React context
- Add `beforeEach` to reset captured opts

**Linter rules:**

- Use `?.` optional chaining, never `!` non-null assertions
- Destructure page arrays: `const [firstPage] = pages; const [item0] = firstPage?.data ?? [];`
- Never use `as any`, `as unknown as`, or `eslint-disable`
