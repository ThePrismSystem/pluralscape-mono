# PR 352 Review Fixes — Design Spec

Date: 2026-04-01
PR: #352 (feat/m8-app-foundation)

## Overview

Fix all important issues, implement actionable suggestions, and fill test coverage gaps identified during the PR 352 review. Changes are organized by domain to minimize cross-cutting churn.

## Auth Domain

### 1. LOGIN state guard

`apps/mobile/src/auth/auth-state-machine.ts:71`

Only accept LOGIN when `kind === "unauthenticated"`. Return early (no-op) otherwise, matching how LOCK/UNLOCK already guard their states. This prevents silent credential replacement when already logged in.

### 2. logout() clearToken resilience

`apps/mobile/src/auth/AuthProvider.tsx:67-70`

Wrap `clearToken()` in a try/catch that logs the failure. The LOGOUT dispatch stays first (user gets immediate UI feedback), but a failed `clearToken` should log rather than throw to the caller — the session is already invalidated server-side. Re-throw after logging so callers can still handle it if needed.

### 3. Remove redundant AuthContextValue fields

`apps/mobile/src/auth/AuthProvider.tsx`

Drop `state`, `session`, `credentials` from `AuthContextValue` interface — consumers destructure from `snapshot` instead. Update consumers:
- `_layout.tsx:72`: `const { state } = useAuth()` → `const { snapshot } = useAuth(); snapshot.state`
- `ConnectionProvider.tsx`: already uses `auth.snapshot`
- `AuthProvider.test.tsx`: update assertions to use `snapshot.state`, `snapshot.session`, etc.

### 4. Remove recovery-key-service.test.ts

`apps/mobile/src/auth/__tests__/recovery-key-service.test.ts`

Delete. Tests only exercise `@pluralscape/crypto` functions already covered in that package's own test suite. No mobile-specific integration value.

## Connection Domain

### 5. onError: propagate error

`apps/mobile/src/connection/connection-manager.ts:32`

Accept `(err: unknown)` in the `onError` callback. Add `lastError: unknown` field to `ConnectionManager`, expose via `getLastError()` method. Store the error before calling `handleConnectionLost()`. Consumers can inspect why reconnection is happening.

### 6. Guard duplicate connect

`apps/mobile/src/connection/connection-manager.ts:56-61`

In the `connect()` method, check `this.stateMachine.getSnapshot() !== "disconnected"` before proceeding. Return early if already connecting/connected/backoff/reconnecting. This prevents accidental double-connect from React strict mode or duplicate auth snapshots.

### 7. Remove onAuthStateChange, make connect/disconnect public

`apps/mobile/src/connection/connection-manager.ts:47-54`

- Make `connect(token, systemId)` public
- Remove `onAuthStateChange(snapshot)` method entirely
- Remove the `AuthStateSnapshot` import from connection-manager.ts
- Move the unlocked-check logic into `ConnectionProvider.tsx`'s useEffect:
  ```ts
  useEffect(() => {
    if (auth.snapshot.state === "unlocked") {
      const { sessionToken, systemId } = auth.snapshot.credentials;
      manager.connect(sessionToken, systemId);
    } else {
      manager.disconnect();
    }
  }, [manager, auth.snapshot]);
  ```
- Update `connection-manager.test.ts` to call `connect(token, systemId)` / `disconnect()` directly instead of constructing AuthStateSnapshot objects
- Update `ConnectionProvider.test.tsx` to verify connect/disconnect calls instead of onAuthStateChange

## SyncProvider

### 8. Module-level constant for context value

`apps/mobile/src/sync/SyncProvider.tsx:24`

Extract inline object as module-level constant:
```ts
const INITIAL_VALUE: SyncContextValue = { engine: DEFERRED_ENGINE, isBootstrapped: false };
```
Pass directly to `<Ctx.Provider value={INITIAL_VALUE}>`.

### 9. Remove "future wiring" comment

`apps/mobile/src/sync/SyncProvider.tsx:19-22`

Delete the speculative comment listing planned hook usage. The scaffold comment above already explains the current state.

## Platform / Detect

### 10. Empty catch blocks

`apps/mobile/src/platform/detect.ts:13,65`

Add `(_err: unknown)` parameter with explanatory comment to both catch blocks:
- Line 13: `catch (_err: unknown) { /* navigator.storage may throw in restrictive contexts */ return false; }`
- Line 65: `catch (_err: unknown) { /* native memzero module not available — adapter uses JS fallback */ }`

### 11. OPFS close() error handling

`apps/mobile/src/platform/drivers/opfs-sqlite-driver.ts:122`

Replace `void sqlite3.close(db)` with proper error handling:
```ts
sqlite3.close(db).catch((err: unknown) => {
  lastError = err instanceof Error ? err : new Error(String(err));
});
```
This matches the existing `trackExec` error storage pattern.

### 12. IndexedDB token store threat model comment

`apps/mobile/src/platform/drivers/indexeddb-token-store.ts`

Add JSDoc to `createIndexedDbTokenStore` documenting:
- Tokens are stored as plaintext in IndexedDB
- IndexedDB is accessible to any JS on the same origin (XSS risk)
- This is a known web platform limitation (no SecureStore equivalent)
- httpOnly cookies would be preferable if the API supports them

## Types / Misc

### 13. rtl.ts parameter type

`apps/mobile/src/i18n/rtl.ts:6`

Change `locale: string` to `locale: Locale`. Import `Locale` is already present. Update test to pass `Locale`-typed values.

### 14. NOTIFICATION_ROUTES literal types

`apps/mobile/src/navigation/linking.ts:3`

Drop `Record<string, string>` annotation. Keep `as const` to preserve literal types. Type becomes inferred from the object literal.

### 15. connection-types.ts default comments

`apps/mobile/src/connection/connection-types.ts:12-13`

Replace inline `// default X` comments with `@default` JSDoc:
```ts
/** @default 30_000 */
readonly maxBackoffMs: number;
/** @default 1_000 */
readonly baseBackoffMs: number;
```

## Work Tracking

### 16. Create bean for crdt-query-bridge TODO

Create a bean tracking the TODO at `packages/data/src/crdt-query-bridge.ts:1`:
> SyncEngine in @pluralscape/sync needs to add a getDocumentSnapshot() method

Type: task, prefix: sync-, status: todo.

## Test Coverage

### 17. nomenclature-wiring.test.ts (new file)

`apps/mobile/src/i18n/__tests__/nomenclature-wiring.test.ts`

Cases:
- null settings → empty object
- empty settings (no nomenclature fields) → empty object
- only systemNomenclature → `{ system: "..." }`
- only memberNomenclature → `{ member: "..." }`
- both fields → `{ system: "...", member: "..." }`

### 18. config.test.ts (new file)

`apps/mobile/src/__tests__/config.test.ts`

Mock `expo-constants`. Cases:
- Configured apiBaseUrl → returns it
- Empty string apiBaseUrl → returns DEV fallback
- Missing extra object → returns DEV fallback
- Missing expoConfig → returns DEV fallback

### 19. detect.test.ts — deepen coverage

`apps/mobile/src/platform/__tests__/detect.test.ts`

Add cases for:
- Web + OPFS available → returns sqlite storage backend
- Web + no OPFS → returns indexeddb storage backend
- Web + navigator.storage throws → falls back to indexeddb
- Native + memzero available → `hasNativeMemzero: true`
- Native + memzero import fails → `hasNativeMemzero: false`

### 20. api-client middleware test

`packages/api-client/src/__tests__/index.test.ts`

Add test verifying auth middleware attaches `Authorization: Bearer <token>` header to requests.

### 21. _layout.test.tsx (new file)

`apps/mobile/app/__tests__/_layout.test.tsx`

Use `vitest-mock-extended` for mocking expo-router, expo-constants, etc. Install as dev dependency in apps/mobile.

Cases:
- Loading state (platform not yet detected) → renders ActivityIndicator
- Init error → renders ErrorScreen with retry button
- Retry clears error and re-initializes
- Auth gate: unauthenticated → redirects to login
- Auth gate: unlocked → renders children (Slot)

### 22. IndexedDB concurrent operation tests

`apps/mobile/src/platform/drivers/__tests__/indexeddb-offline-queue-adapter.test.ts`

Add cases:
- Concurrent enqueue operations complete without data loss
- Concurrent markSynced + drainUnsynced returns consistent results

## Out of Scope

- **ErasedGet cast** in rest-query-factory — well-documented pragmatic trade-off
- **`data as TData`** in rest-query-factory — default `unknown` makes this safe
- **BiometricKeyStore refactor** — thin wrapper by design
- **SseEvent single variant** — forward-looking for heartbeat/error events
