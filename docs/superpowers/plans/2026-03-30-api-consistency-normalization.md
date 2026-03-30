# API Consistency Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize the API response surface with a `{ data: T }` envelope, rename pagination `items` → `data`, add POST idempotency key infrastructure, and paginate device tokens — so every endpoint follows one consistent contract.

**Architecture:** All successful responses (except 204 no-content) are wrapped in `{ data: T }`. List endpoints use `{ data: T[], nextCursor, hasMore, totalCount }`. POST-create endpoints accept an opt-in `Idempotency-Key` header backed by Valkey for safe retries. The envelope is applied at the route layer; services return raw data unchanged.

**Tech Stack:** Hono (routing/middleware), Valkey/ioredis (idempotency storage), TypeScript, Vitest (unit/integration), Playwright (E2E)

---

## File Map

### New Files
- `apps/api/src/middleware/idempotency.ts` — Idempotency-Key middleware
- `apps/api/src/middleware/idempotency.constants.ts` — TTL, lock duration, key prefix constants
- `apps/api/src/middleware/stores/valkey-idempotency-store.ts` — Valkey get/set/lock for idempotency
- `apps/api/src/middleware/idempotency-store.ts` — IdempotencyStore interface
- `apps/api/src/middleware/stores/memory-idempotency-store.ts` — In-memory fallback for tests
- `apps/api/src/__tests__/middleware/idempotency.test.ts` — Unit tests for middleware
- `apps/api/src/__tests__/middleware/idempotency.integration.test.ts` — Integration tests with Valkey
- `apps/api-e2e/src/tests/idempotency/idempotency.spec.ts` — E2E idempotency tests

### Modified Files
- `packages/types/src/pagination.ts` — Rename `items` → `data` in `PaginatedResult<T>`
- `packages/types/src/results.ts` — Remove `ActionResult` interface
- `packages/types/src/index.ts` — Remove `ActionResult` export
- `packages/types/src/api-constants.ts` — Add `IDEMPOTENCY_CONFLICT` error code
- `apps/api/src/lib/response.ts` — Replace `wrapResult`/`wrapAction` with `envelope()`
- `apps/api/src/lib/pagination.ts` — Rename `items` → `data` in builder functions
- `apps/api/src/http.constants.ts` — (already has HTTP_CONFLICT=409, no change needed)
- `apps/api/src/middleware/rate-limit.ts` — Reference pattern for idempotency store wiring
- All route handlers under `apps/api/src/routes/` — Wrap `c.json()` calls with `envelope()`
- All test files under `apps/api/src/__tests__/` — Update `.items` → `.data`, add `.data` envelope unwrapping
- All E2E tests under `apps/api-e2e/src/tests/` — Update response assertions
- `apps/api/src/routes/device-tokens/list.ts` — Add cursor pagination
- `apps/api/src/services/device-token.service.ts` — Add paginated list query

---

## Task 1: Add IDEMPOTENCY_CONFLICT Error Code

**Files:**
- Modify: `packages/types/src/api-constants.ts:97-139`
- Test: `packages/types/src/__tests__/api-constants.test.ts` (if exists, otherwise compiler validates)

- [ ] **Step 1: Add the error code to API_ERROR_CODES**

In `packages/types/src/api-constants.ts`, add `IDEMPOTENCY_CONFLICT` to the `API_ERROR_CODES` object, after the `CONFLICT` entry:

```typescript
  CONFLICT: "CONFLICT",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  HAS_DEPENDENTS: "HAS_DEPENDENTS",
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm typecheck > .tmp/typecheck-task1.txt 2>&1`
Expected: PASS (no errors)

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/api-constants.ts
git commit -m "feat(types): add IDEMPOTENCY_CONFLICT error code"
```

---

## Task 2: Rename PaginatedResult.items → data

**Files:**
- Modify: `packages/types/src/pagination.ts:7-12`
- Modify: `apps/api/src/lib/pagination.ts:149-187`
- Test: TypeScript compiler catches all consumers

- [ ] **Step 1: Rename the field in the PaginatedResult type**

In `packages/types/src/pagination.ts`, change line 8:

```typescript
// Before
readonly items: readonly T[];

// After
readonly data: readonly T[];
```

- [ ] **Step 2: Update buildPaginatedResult in apps/api/src/lib/pagination.ts**

Replace all `items` references in the function (lines 149-162):

```typescript
export function buildPaginatedResult<TRow, TResult extends { id: string }>(
  rows: readonly TRow[],
  limit: number,
  mapper: (row: TRow) => TResult,
): PaginatedResult<TResult> {
  if (limit <= 0) {
    return { data: [], nextCursor: null, hasMore: false, totalCount: null };
  }
  const hasMore = rows.length > limit;
  const data = (hasMore ? rows.slice(0, limit) : rows).map(mapper);
  const lastItem = data[data.length - 1];
  const nextCursor = hasMore && lastItem ? toCursor(lastItem.id) : null;
  return { data, nextCursor, hasMore, totalCount: null };
}
```

- [ ] **Step 3: Update buildCompositePaginatedResult in apps/api/src/lib/pagination.ts**

Replace all `items` references in the function (lines 172-187):

```typescript
export function buildCompositePaginatedResult<TRow, TResult extends { id: string }>(
  rows: readonly TRow[],
  limit: number,
  mapper: (row: TRow) => TResult,
  sortValueExtractor: (item: TResult) => number,
): PaginatedResult<TResult> {
  if (limit <= 0) {
    return { data: [], nextCursor: null, hasMore: false, totalCount: null };
  }
  const hasMore = rows.length > limit;
  const data = (hasMore ? rows.slice(0, limit) : rows).map(mapper);
  const lastItem = data[data.length - 1];
  const nextCursor =
    hasMore && lastItem ? toCompositeCursor(sortValueExtractor(lastItem), lastItem.id) : null;
  return { data, nextCursor, hasMore, totalCount: null };
}
```

- [ ] **Step 4: Run typecheck to find all broken references**

Run: `pnpm typecheck > .tmp/typecheck-task2.txt 2>&1`
Expected: FAIL with many errors pointing to `.items` references across route handlers, services, and tests. This is expected — the compiler output is our migration checklist.

- [ ] **Step 5: Fix route handlers that reference .items**

Three route handlers access `.items` directly and need updating:

In `apps/api/src/routes/members/list.ts`, line 51-56:
```typescript
// Before
if (!fields) return c.json(result);
return c.json({
  ...result,
  items: result.items.map((item) => filterFields(item, fields)),
});

// After
if (!fields) return c.json(result);
return c.json({
  ...result,
  data: result.data.map((item) => filterFields(item, fields)),
});
```

Apply the same `.items` → `.data` rename in:
- `apps/api/src/routes/groups/list.ts` (same sparse fieldset pattern)
- `apps/api/src/routes/fields/list.ts` (same sparse fieldset pattern)
- `apps/api/src/routes/members/photos/reorder.ts` — this uses `wrapResult({ items: result })` which will be handled in Task 3

- [ ] **Step 6: Bulk rename .items → .data in all service test files**

Use find-and-replace across `apps/api/src/__tests__/` to rename `.items` → `.data` in all test assertions. The TypeScript compiler output from Step 4 identifies every file. Common patterns to replace:

```
result.items  →  result.data
.items.length  →  .data.length
.items[0]  →  .data[0]
.items.find  →  .data.find
.items.map  →  .data.map
expect(result.items)  →  expect(result.data)
```

- [ ] **Step 7: Bulk rename .items → .data in E2E test files**

Apply the same find-and-replace across `apps/api-e2e/src/tests/`. Common patterns:

```
listed.items  →  listed.data
body.items  →  body.data
.items.length  →  .data.length
.items[0]  →  .data[0]
```

- [ ] **Step 8: Fix any remaining .items references found by typecheck**

Run: `pnpm typecheck > .tmp/typecheck-task2b.txt 2>&1`
Expected: PASS. If not, fix remaining references identified by compiler.

- [ ] **Step 9: Run tests to verify**

Run: `pnpm test:unit > .tmp/unit-task2.txt 2>&1`
Run: `pnpm test:integration > .tmp/integration-task2.txt 2>&1`
Expected: PASS (all tests should pass with renamed field)

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor(api): rename PaginatedResult.items to .data for uniform envelope"
```

---

## Task 3: Replace wrapResult/wrapAction with envelope() Helper

**Files:**
- Modify: `apps/api/src/lib/response.ts`
- Modify: `packages/types/src/results.ts` — Remove `ActionResult`
- Modify: `packages/types/src/index.ts` — Remove `ActionResult` export
- Modify: 11 route files that import `wrapResult`/`wrapAction`

- [ ] **Step 1: Replace response.ts with envelope() helper**

Replace the entire contents of `apps/api/src/lib/response.ts`:

```typescript
/** Wrap a success payload in the standard { data } envelope. */
export function envelope<T>(data: T): { readonly data: T } {
  return { data };
}
```

- [ ] **Step 2: Remove ActionResult from packages/types**

In `packages/types/src/results.ts`, remove lines 27-29:

```typescript
// DELETE these lines:
/** Standard mutation confirmation payload. */
export interface ActionResult {
  readonly success: true;
}
```

In `packages/types/src/index.ts`, remove the `ActionResult` export from the re-export list.

- [ ] **Step 3: Migrate routes that used wrapAction() with no args**

These routes used `wrapAction()` which returned `{ data: { success: true } }`. Since `success: true` is redundant (2xx signals success), convert them to 204 no-content responses where the operation has no meaningful return value:

**`apps/api/src/routes/account/pin/set-pin.ts`:**
```typescript
// Before
import { wrapAction } from "../../../lib/response.js";
// ...
return c.json(wrapAction());

// After (remove wrapAction import, add HTTP_NO_CONTENT import)
import { HTTP_NO_CONTENT } from "../../../http.constants.js";
// ...
return c.body(null, HTTP_NO_CONTENT);
```

Apply the same pattern to:
- `apps/api/src/routes/account/pin/remove-pin.ts`
- `apps/api/src/routes/systems/settings/pin/set-pin.ts`
- `apps/api/src/routes/systems/settings/pin/remove-pin.ts`
- `apps/api/src/routes/systems/setup/nomenclature-step.ts`
- `apps/api/src/routes/systems/setup/profile-step.ts`

- [ ] **Step 4: Migrate routes that used wrapAction() with details**

**`apps/api/src/routes/auth/sessions.ts`** (revoke-all, line 84):
```typescript
// Before
import { wrapAction } from "../../lib/response.js";
return c.json(wrapAction({ revokedCount: count }));

// After
import { envelope } from "../../lib/response.js";
return c.json(envelope({ revokedCount: count }));
```

- [ ] **Step 5: Migrate routes that used wrapResult()**

**`apps/api/src/routes/systems/setup/status.ts`:**
```typescript
// Before
import { wrapResult } from "../../../lib/response.js";
return c.json(wrapResult(result));

// After
import { envelope } from "../../../lib/response.js";
return c.json(envelope(result));
```

**`apps/api/src/routes/systems/setup/complete.ts`:**
```typescript
// Before
import { wrapResult } from "../../../lib/response.js";
return c.json(wrapResult(result));

// After
import { envelope } from "../../../lib/response.js";
return c.json(envelope(result));
```

**`apps/api/src/routes/members/photos/reorder.ts`:**
```typescript
// Before
import { wrapResult } from "../../../lib/response.js";
return c.json(wrapResult({ items: result }));

// After
import { envelope } from "../../../lib/response.js";
return c.json(envelope({ data: result }));
```

**`apps/api/src/routes/fields/create-field-value-routes.ts`:**
```typescript
// Before
import { wrapResult } from "../../lib/response.js";
return c.json(wrapResult({ items: result }));

// After
import { envelope } from "../../lib/response.js";
return c.json(envelope({ data: result }));
```

- [ ] **Step 6: Verify no remaining references to wrapResult/wrapAction**

Run: `grep -r "wrapResult\|wrapAction\|ActionResult" apps/api/src/ packages/types/src/ --include="*.ts" | grep -v node_modules | grep -v ".test.ts" | grep -v "__tests__"`
Expected: No matches (except possibly test files which we'll fix next)

- [ ] **Step 7: Update tests for the migrated routes**

Update any tests that assert on `{ data: { success: true } }` or `wrapAction`/`wrapResult` behavior. For routes converted to 204, tests should assert `response.status === 204` with no body. For routes using `envelope()`, tests should assert `response.body.data.revokedCount` etc.

- [ ] **Step 8: Run typecheck and tests**

Run: `pnpm typecheck > .tmp/typecheck-task3.txt 2>&1`
Run: `pnpm test:unit > .tmp/unit-task3.txt 2>&1`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(api): replace wrapResult/wrapAction with envelope() helper"
```

---

## Task 4: Envelope All Route Responses — Auth & Account

**Files:**
- Modify: All route handlers in `apps/api/src/routes/auth/` and `apps/api/src/routes/account/`
- Modify: Corresponding tests in `apps/api/src/__tests__/` and `apps/api-e2e/src/tests/`

**IMPORTANT — Envelope rules for ALL domain batch tasks (Tasks 4-11):**

1. **Single-resource routes** (GET one, POST create, PUT update): wrap with `envelope()`:
   ```typescript
   return c.json(envelope(result));           // 200
   return c.json(envelope(result), HTTP_CREATED); // 201
   ```

2. **List routes** returning `PaginatedResult`: do **NOT** wrap with `envelope()`. After Task 2, `PaginatedResult` already has `{ data: T[], nextCursor, hasMore, totalCount }` — wrapping would double-nest to `{ data: { data: [...] } }`. Leave list routes as `return c.json(result);`.

3. **204 routes** (delete, archive, restore, logout): no change — `c.body(null, HTTP_NO_CONTENT)`.

4. **Test updates for list endpoints**: List endpoint response shapes change from `.items` to `.data` (already done in Task 2's bulk rename). No additional `.data.data` nesting.

5. **Test updates for single-resource endpoints**: Response body access changes from `body.someField` to `body.data.someField`.

- [ ] **Step 1: Add envelope import and wrap all c.json() calls in auth routes**

For every **non-list** route under `apps/api/src/routes/auth/` that returns `c.json(result)` or `c.json(result, HTTP_CREATED)`, add:

```typescript
import { envelope } from "../../lib/response.js";
```

And change:
```typescript
// Before
return c.json(result);
return c.json(result, HTTP_CREATED);

// After
return c.json(envelope(result));
return c.json(envelope(result), HTTP_CREATED);
```

**Do NOT change:**
- Routes returning `c.body(null, HTTP_NO_CONTENT)` — these stay as-is (204 has no body)
- List routes returning `PaginatedResult` — already have `data` field, no envelope needed
- The revoke-all route already migrated in Task 3

Files to modify:
- `auth/login.ts` — `c.json(result)` → `c.json(envelope(result))`
- `auth/register.ts` — `c.json(result, HTTP_CREATED)` → `c.json(envelope(result), HTTP_CREATED)`
- `auth/biometric.ts` — both enroll (201) and verify (200) responses
- `auth/password-reset.ts` — `c.json(result)` → `c.json(envelope(result))`
- `auth/recovery-key.ts` — GET status (200) and POST regenerate (201)
- `auth/sessions.ts` — list endpoint (200), revoke-all already done

- [ ] **Step 2: Add envelope to all account routes**

Same pattern for all routes under `apps/api/src/routes/account/`:
- `account/get.ts`, `account/change-password.ts`, `account/change-email.ts`
- `account/update-settings.ts`, `account/audit-log.ts`, `account/device-transfer.ts`
- `account/pin/verify.ts`
- `account/friend-codes/create.ts` (201), `account/friend-codes/redeem.ts` (201), `account/friend-codes/list.ts`
- `account/friends/` — all GET/POST routes returning JSON

- [ ] **Step 3: Update auth & account unit/integration tests**

For every test that asserts on response body fields, wrap access through `.data`:

```typescript
// Before
expect(result.sessionToken).toBeDefined();
expect(result.accountId).toBeDefined();

// After
expect(result.data.sessionToken).toBeDefined();
expect(result.data.accountId).toBeDefined();
```

- [ ] **Step 4: Update auth & account E2E tests**

Update assertions in:
- `apps/api-e2e/src/tests/auth/login.spec.ts`
- `apps/api-e2e/src/tests/auth/register.spec.ts`
- `apps/api-e2e/src/tests/auth/sessions.spec.ts`
- `apps/api-e2e/src/tests/account/account.spec.ts`
- `apps/api-e2e/src/tests/device-transfer/device-transfer.spec.ts`
- `apps/api-e2e/src/tests/friends/lifecycle.spec.ts`
- `apps/api-e2e/src/tests/friends/codes.spec.ts`
- `apps/api-e2e/src/tests/friends/export.spec.ts`
- `apps/api-e2e/src/tests/friends/dashboard.spec.ts`
- `apps/api-e2e/src/fixtures/auth.fixture.ts` (if it accesses response fields)
- `apps/api-e2e/src/fixtures/entity-helpers.ts` (if it accesses response fields)
- `apps/api-e2e/src/fixtures/friend.fixture.ts` (if it accesses response fields)

Pattern: `const body = await res.json()` then `body.someField` → `body.data.someField`

- [ ] **Step 5: Run typecheck and tests**

Run: `pnpm typecheck > .tmp/typecheck-task4.txt 2>&1`
Run: `pnpm test:unit > .tmp/unit-task4.txt 2>&1`
Run: `pnpm test:integration > .tmp/integration-task4.txt 2>&1`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(api): envelope auth and account route responses"
```

---

## Task 5: Envelope All Route Responses — Systems & Setup

**Files:**
- Modify: All route handlers in `apps/api/src/routes/systems/`
- Modify: Corresponding tests

- [ ] **Step 1: Add envelope to all systems routes**

Same pattern as Task 4. Files:
- `systems/create.ts` (201), `systems/get.ts`, `systems/update.ts`, `systems/list.ts`
- `systems/duplicate.ts` (201)
- `systems/nomenclature/get-nomenclature.ts`, `systems/nomenclature/update-nomenclature.ts`
- `systems/settings/get-settings.ts`, `systems/settings/update-settings.ts`
- `systems/settings/pin/verify.ts`
- `systems/setup/status.ts` — already uses `envelope()` from Task 3
- `systems/setup/complete.ts` — already uses `envelope()` from Task 3
- `systems/snapshots/create.ts` (201), `systems/snapshots/get.ts`, `systems/snapshots/list.ts`

- [ ] **Step 2: Update systems tests**

Update unit/integration tests and E2E tests:
- `apps/api-e2e/src/tests/systems/crud.spec.ts`
- Relevant unit/integration test files

- [ ] **Step 3: Run typecheck and tests**

Run: `pnpm typecheck > .tmp/typecheck-task5.txt 2>&1`
Run: `pnpm test:unit > .tmp/unit-task5.txt 2>&1`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(api): envelope systems route responses"
```

---

## Task 6: Envelope All Route Responses — Members & Groups

**Files:**
- Modify: All route handlers in `apps/api/src/routes/members/` and `apps/api/src/routes/groups/`
- Modify: Corresponding tests

- [ ] **Step 1: Add envelope to all members routes**

Files:
- `members/create.ts` (201), `members/get.ts`, `members/list.ts`, `members/update.ts`
- `members/duplicate.ts` (201), `members/memberships.ts`
- `members/photos/create.ts` (201), `members/photos/get.ts`, `members/photos/list.ts`
- `members/photos/reorder.ts` — already uses `envelope()` from Task 3
- `members/fields/` — all field value routes (created via factory in `fields/create-field-value-routes.ts`)

Note: The `create-field-value-routes.ts` factory creates routes for member fields, group fields, and structure entity fields. It was partially migrated in Task 3. Ensure all `c.json()` calls in the factory use `envelope()`.

- [ ] **Step 2: Add envelope to all groups routes**

Files:
- `groups/create.ts` (201), `groups/get.ts`, `groups/list.ts`, `groups/update.ts`
- `groups/copy.ts` (201), `groups/move.ts`, `groups/reorder.ts`, `groups/tree.ts`
- `groups/members/add.ts`, `groups/members/list.ts`
- `groups/fields/` — field value routes (factory)

- [ ] **Step 3: Update tests**

Update unit/integration tests and E2E tests:
- `apps/api-e2e/src/tests/members/crud.spec.ts`
- `apps/api-e2e/src/tests/groups/crud.spec.ts`
- `apps/api-e2e/src/tests/fields/crud.spec.ts`

- [ ] **Step 4: Run typecheck and tests**

Run: `pnpm typecheck > .tmp/typecheck-task6.txt 2>&1`
Run: `pnpm test:unit > .tmp/unit-task6.txt 2>&1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(api): envelope members and groups route responses"
```

---

## Task 7: Envelope All Route Responses — Fronting

**Files:**
- Modify: All route handlers in `apps/api/src/routes/fronting/`, `fronting-sessions/`, `fronting-reports/`, `custom-fronts/`
- Modify: Corresponding tests

- [ ] **Step 1: Add envelope to all fronting routes**

Files:
- `fronting/active.ts`
- `fronting-sessions/create.ts` (201), `fronting-sessions/get.ts`, `fronting-sessions/list.ts`, `fronting-sessions/update.ts`, `fronting-sessions/end.ts`
- `fronting-sessions/comments/create.ts` (201), `comments/get.ts`, `comments/list.ts`, `comments/update.ts`
- `fronting-reports/create.ts` (201), `fronting-reports/get.ts`, `fronting-reports/list.ts`, `fronting-reports/update.ts`
- `custom-fronts/create.ts` (201), `custom-fronts/get.ts`, `custom-fronts/list.ts`, `custom-fronts/update.ts`

- [ ] **Step 2: Update fronting tests**

- `apps/api-e2e/src/tests/fronting/fronting-sessions.spec.ts`
- `apps/api-e2e/src/tests/fronting/comments.spec.ts`
- `apps/api-e2e/src/tests/custom-fronts/crud.spec.ts`

- [ ] **Step 3: Run typecheck and tests**

Run: `pnpm typecheck > .tmp/typecheck-task7.txt 2>&1`
Run: `pnpm test:unit > .tmp/unit-task7.txt 2>&1`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(api): envelope fronting route responses"
```

---

## Task 8: Envelope All Route Responses — Communication

**Files:**
- Modify: All route handlers in `apps/api/src/routes/channels/`, `messages/`, `board-messages/`, `notes/`, `polls/`, `acknowledgements/`
- Modify: Corresponding tests

- [ ] **Step 1: Add envelope to all communication routes**

Files:
- `channels/create.ts` (201), `channels/get.ts`, `channels/list.ts`, `channels/update.ts`
- `messages/create.ts` (201), `messages/get.ts`, `messages/list.ts`, `messages/update.ts`
- `board-messages/create.ts` (201), `board-messages/get.ts`, `board-messages/list.ts`, `board-messages/update.ts`, `board-messages/pin.ts`, `board-messages/unpin.ts`, `board-messages/reorder.ts`
- `notes/create.ts` (201), `notes/get.ts`, `notes/list.ts`, `notes/update.ts`
- `polls/create.ts` (201), `polls/get.ts`, `polls/list.ts`, `polls/update.ts`, `polls/cast-vote.ts` (201), `polls/update-vote.ts`, `polls/close.ts`, `polls/results.ts`, `polls/list-votes.ts`
- `acknowledgements/create.ts` (201), `acknowledgements/get.ts`, `acknowledgements/list.ts`, `acknowledgements/confirm.ts`

- [ ] **Step 2: Update communication tests**

- `apps/api-e2e/src/tests/chat/channels.spec.ts`
- `apps/api-e2e/src/tests/chat/messages.spec.ts`
- `apps/api-e2e/src/tests/chat/board-messages.spec.ts`
- `apps/api-e2e/src/tests/notes/crud.spec.ts`
- `apps/api-e2e/src/tests/polls/crud.spec.ts`
- `apps/api-e2e/src/tests/polls/voting.spec.ts`
- `apps/api-e2e/src/tests/acknowledgements/crud.spec.ts`

- [ ] **Step 3: Run typecheck and tests**

Run: `pnpm typecheck > .tmp/typecheck-task8.txt 2>&1`
Run: `pnpm test:unit > .tmp/unit-task8.txt 2>&1`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(api): envelope communication route responses"
```

---

## Task 9: Envelope All Route Responses — Structure

**Files:**
- Modify: All route handlers in `apps/api/src/routes/structure/`, `innerworld/`, `relationships/`
- Modify: Corresponding tests

- [ ] **Step 1: Add envelope to all structure routes**

Files:
- `structure/entities/create.ts` (201), `entities/get.ts`, `entities/list.ts`, `entities/update.ts`, `entities/hierarchy.ts`
- `structure/entities/fields/` — field value routes (factory)
- `structure/entity-types/create.ts` (201), `entity-types/get.ts`, `entity-types/list.ts`, `entity-types/update.ts`
- `structure/entity-links/create.ts` (201), `entity-links/list.ts`, `entity-links/update.ts`
- `structure/entity-member-links/create.ts` (201), `entity-member-links/list.ts`
- `structure/entity-associations/create.ts` (201), `entity-associations/list.ts`
- `innerworld/entities/create.ts` (201), `entities/get.ts`, `entities/list.ts`, `entities/update.ts`
- `innerworld/regions/create.ts` (201), `regions/get.ts`, `regions/list.ts`, `regions/update.ts`
- `innerworld/canvas/` — if any JSON-returning routes exist
- `relationships/create.ts` (201), `relationships/get.ts`, `relationships/list.ts`, `relationships/update.ts`

- [ ] **Step 2: Update structure tests**

- `apps/api-e2e/src/tests/innerworld/crud.spec.ts`
- `apps/api-e2e/src/tests/relationships/crud.spec.ts`
- Relevant unit/integration tests

- [ ] **Step 3: Run typecheck and tests**

Run: `pnpm typecheck > .tmp/typecheck-task9.txt 2>&1`
Run: `pnpm test:unit > .tmp/unit-task9.txt 2>&1`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(api): envelope structure route responses"
```

---

## Task 10: Envelope All Route Responses — Fields & Buckets

**Files:**
- Modify: All route handlers in `apps/api/src/routes/fields/`, `buckets/`
- Modify: Corresponding tests

- [ ] **Step 1: Add envelope to all fields routes**

Files:
- `fields/create.ts` (201), `fields/get.ts`, `fields/list.ts`, `fields/update.ts`
- `fields/bucket-visibility/set.ts`, `fields/bucket-visibility/list.ts`
- `fields/create-field-value-routes.ts` — factory: ensure all `c.json()` calls use `envelope()` (partially done in Task 3)

- [ ] **Step 2: Add envelope to all buckets routes**

Files:
- `buckets/create.ts` (201), `buckets/get.ts`, `buckets/list.ts`, `buckets/update.ts`, `buckets/export.ts`
- `buckets/rotations/initiate.ts` (201), `rotations/claim.ts`, `rotations/progress.ts`, `rotations/complete-chunk.ts`, `rotations/retry.ts`
- `buckets/friends/assign.ts`, `buckets/friends/list.ts`
- `buckets/tags/tag.ts`, `buckets/tags/list.ts`

- [ ] **Step 3: Update fields & buckets tests**

- `apps/api-e2e/src/tests/fields/crud.spec.ts`
- `apps/api-e2e/src/tests/buckets/crud.spec.ts`
- `apps/api-e2e/src/tests/buckets/rotation.spec.ts`
- `apps/api-e2e/src/tests/buckets/tags.spec.ts`
- `apps/api-e2e/src/tests/buckets/field-visibility.spec.ts`
- `apps/api-e2e/src/tests/buckets/export.spec.ts`

- [ ] **Step 4: Run typecheck and tests**

Run: `pnpm typecheck > .tmp/typecheck-task10.txt 2>&1`
Run: `pnpm test:unit > .tmp/unit-task10.txt 2>&1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(api): envelope fields and buckets route responses"
```

---

## Task 11: Envelope All Route Responses — Remaining Domains

**Files:**
- Modify: All route handlers in `apps/api/src/routes/blobs/`, `webhook-configs/`, `webhook-deliveries/`, `timer-configs/`, `notifications/`, `notification-configs/`, `api-keys/`, `analytics/`, `check-in-records/`, `lifecycle-events/`
- Modify: Corresponding tests

- [ ] **Step 1: Add envelope to blobs routes**

- `blobs/upload-url.ts` (201), `blobs/get.ts`, `blobs/download-url.ts`, `blobs/list.ts`, `blobs/confirm.ts`

- [ ] **Step 2: Add envelope to webhook routes**

- `webhook-configs/create.ts` (201), `webhook-configs/get.ts`, `webhook-configs/list.ts`, `webhook-configs/update.ts`, `webhook-configs/test.ts`, `webhook-configs/rotate-secret.ts`
- `webhook-deliveries/get.ts`, `webhook-deliveries/list.ts`

- [ ] **Step 3: Add envelope to timer, notification, device-token, api-key, analytics, check-in, lifecycle routes**

- `timer-configs/create.ts` (201), `timer-configs/get.ts`, `timer-configs/list.ts`, `timer-configs/update.ts`
- `notification-configs/list.ts`, `notification-configs/update.ts`
- `device-tokens/register.ts` (201), `device-tokens/list.ts`, `device-tokens/update.ts`, `device-tokens/revoke.ts`
- `api-keys/create.ts` (201), `api-keys/get.ts`, `api-keys/list.ts`, `api-keys/revoke.ts`
- `analytics/fronting.ts`, `analytics/co-fronting.ts`
- `check-in-records/create.ts` (201), `check-in-records/get.ts`, `check-in-records/list.ts`, `check-in-records/respond.ts`, `check-in-records/dismiss.ts`
- `lifecycle-events/create.ts` (201), `lifecycle-events/get.ts`, `lifecycle-events/list.ts`, `lifecycle-events/update.ts`

Note: `notifications/stream.ts` is SSE — do NOT wrap, it streams events not JSON.

- [ ] **Step 4: Update remaining domain tests**

- `apps/api-e2e/src/tests/blobs/crud.spec.ts`
- `apps/api-e2e/src/tests/webhooks/webhook-flow.spec.ts`
- `apps/api-e2e/src/tests/webhooks/communication-webhooks.spec.ts`
- `apps/api-e2e/src/tests/timers/timer-check-in.spec.ts`
- `apps/api-e2e/src/tests/notifications/sse-stream.spec.ts`
- `apps/api-e2e/src/tests/notifications/device-tokens.spec.ts`
- `apps/api-e2e/src/tests/notifications/notification-configs.spec.ts`
- `apps/api-e2e/src/tests/notifications/friend-notification-preferences.spec.ts`

- [ ] **Step 5: Run typecheck and tests**

Run: `pnpm typecheck > .tmp/typecheck-task11.txt 2>&1`
Run: `pnpm test:unit > .tmp/unit-task11.txt 2>&1`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(api): envelope remaining domain route responses"
```

---

## Task 12: Paginate Device Tokens List Endpoint

**Files:**
- Modify: `apps/api/src/routes/device-tokens/list.ts`
- Modify: `apps/api/src/services/device-token.service.ts`
- Test: `apps/api/src/__tests__/services/device-token.*.test.ts`
- Test: `apps/api-e2e/src/tests/notifications/device-tokens.spec.ts`

- [ ] **Step 1: Write failing test for paginated device token list**

Add a test in the device token integration test file that asserts the list endpoint returns `{ data: [...], nextCursor, hasMore, totalCount }` shape instead of `{ data: [...] }`.

```typescript
it("returns paginated result shape", async () => {
  const result = await listDeviceTokens(db, systemId, auth, { cursor: undefined, limit: 25 });
  expect(result).toHaveProperty("data");
  expect(result).toHaveProperty("nextCursor");
  expect(result).toHaveProperty("hasMore");
  expect(result).toHaveProperty("totalCount");
  expect(Array.isArray(result.data)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project device-token-integration > .tmp/device-token-test.txt 2>&1` (adjust project name as needed)
Expected: FAIL — current function doesn't return paginated shape

- [ ] **Step 3: Update service to return PaginatedResult**

In `apps/api/src/services/device-token.service.ts`, modify `listDeviceTokens` to accept pagination params and use `buildPaginatedResult`:

```typescript
import { buildPaginatedResult, parsePaginationLimit } from "../lib/pagination.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../service.constants.js";

export async function listDeviceTokens(
  db: Database,
  systemId: SystemId,
  auth: AuthContext,
  options: { cursor: string | undefined; limit: number },
): Promise<PaginatedResult<DeviceTokenResult>> {
  // Query with limit+1 for hasMore detection
  // ... existing query logic with cursor and limit+1 ...
  return buildPaginatedResult(rows, options.limit, mapDeviceToken);
}
```

- [ ] **Step 4: Update route handler**

In `apps/api/src/routes/device-tokens/list.ts`:

```typescript
import { parseCursor, parsePaginationLimit } from "../../lib/pagination.js";
import { envelope } from "../../lib/response.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const cursor = parseCursor(c.req.query("cursor"));
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  const db = await getDb();
  const result = await listDeviceTokens(db, systemId, auth, { cursor, limit });
  return c.json(result);
});
```

Note: List endpoints already have their pagination fields at top level (`{ data, nextCursor, hasMore, totalCount }`), so no additional `envelope()` wrapping is needed — the `data` field from `PaginatedResult` IS the envelope.

- [ ] **Step 5: Run tests**

Run: `pnpm test:unit > .tmp/unit-task12.txt 2>&1`
Run: `pnpm test:integration > .tmp/integration-task12.txt 2>&1`
Expected: PASS

- [ ] **Step 6: Update E2E test**

Update `apps/api-e2e/src/tests/notifications/device-tokens.spec.ts` to assert paginated shape.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(api): paginate device tokens list endpoint"
```

---

## Task 13: Idempotency Store Interface and In-Memory Implementation

**Files:**
- Create: `apps/api/src/middleware/idempotency-store.ts`
- Create: `apps/api/src/middleware/idempotency.constants.ts`
- Create: `apps/api/src/middleware/stores/memory-idempotency-store.ts`
- Test: `apps/api/src/__tests__/middleware/idempotency-store.test.ts`

- [ ] **Step 1: Write failing tests for idempotency store**

Create `apps/api/src/__tests__/middleware/idempotency-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryIdempotencyStore } from "../../middleware/stores/memory-idempotency-store.js";
import type { CachedResponse } from "../../middleware/idempotency-store.js";

describe("MemoryIdempotencyStore", () => {
  let store: MemoryIdempotencyStore;

  beforeEach(() => {
    store = new MemoryIdempotencyStore();
  });

  it("returns null for unknown key", async () => {
    const result = await store.get("account-1", "key-1");
    expect(result).toBeNull();
  });

  it("stores and retrieves a cached response", async () => {
    const cached: CachedResponse = { statusCode: 201, body: '{"data":{"id":"123"}}' };
    await store.set("account-1", "key-1", cached);
    const result = await store.get("account-1", "key-1");
    expect(result).toEqual(cached);
  });

  it("scopes keys by account", async () => {
    const cached: CachedResponse = { statusCode: 201, body: '{"data":{"id":"123"}}' };
    await store.set("account-1", "key-1", cached);
    const result = await store.get("account-2", "key-1");
    expect(result).toBeNull();
  });

  it("acquires lock for new key", async () => {
    const acquired = await store.acquireLock("account-1", "key-1");
    expect(acquired).toBe(true);
  });

  it("fails to acquire lock when already held", async () => {
    await store.acquireLock("account-1", "key-1");
    const acquired = await store.acquireLock("account-1", "key-1");
    expect(acquired).toBe(false);
  });

  it("releases lock allowing re-acquisition", async () => {
    await store.acquireLock("account-1", "key-1");
    await store.releaseLock("account-1", "key-1");
    const acquired = await store.acquireLock("account-1", "key-1");
    expect(acquired).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run --project api apps/api/src/__tests__/middleware/idempotency-store.test.ts > .tmp/idempotency-store-test.txt 2>&1`
Expected: FAIL — modules don't exist yet

- [ ] **Step 3: Create constants file**

Create `apps/api/src/middleware/idempotency.constants.ts`:

```typescript
/** Valkey key prefix for idempotency cached responses. */
export const IDEMPOTENCY_KEY_PREFIX = "ps:idem:";

/** Valkey key prefix for idempotency in-flight locks. */
export const IDEMPOTENCY_LOCK_PREFIX = "ps:idem:lock:";

/** TTL for cached idempotency responses (24 hours in seconds). */
export const IDEMPOTENCY_CACHE_TTL_SEC = 86_400;

/** TTL for in-flight request locks (30 seconds). */
export const IDEMPOTENCY_LOCK_TTL_SEC = 30;

/** HTTP header name for idempotency key. */
export const IDEMPOTENCY_KEY_HEADER = "idempotency-key";

/** Maximum length for idempotency key values (UUID = 36 chars, allow some margin). */
export const IDEMPOTENCY_KEY_MAX_LENGTH = 64;
```

- [ ] **Step 4: Create store interface**

Create `apps/api/src/middleware/idempotency-store.ts`:

```typescript
/** Shape of a cached idempotency response. */
export interface CachedResponse {
  readonly statusCode: number;
  readonly body: string;
}

/** Storage backend for idempotency key middleware. */
export interface IdempotencyStore {
  /** Retrieve a cached response, or null if not found / expired. */
  get(accountId: string, key: string): Promise<CachedResponse | null>;

  /** Store a response for the given idempotency key. */
  set(accountId: string, key: string, response: CachedResponse): Promise<void>;

  /** Attempt to acquire an in-flight lock. Returns true if acquired, false if already held. */
  acquireLock(accountId: string, key: string): Promise<boolean>;

  /** Release an in-flight lock. */
  releaseLock(accountId: string, key: string): Promise<void>;
}
```

- [ ] **Step 5: Create in-memory implementation**

Create `apps/api/src/middleware/stores/memory-idempotency-store.ts`:

```typescript
import {
  IDEMPOTENCY_CACHE_TTL_SEC,
  IDEMPOTENCY_LOCK_TTL_SEC,
} from "../idempotency.constants.js";

import type { CachedResponse, IdempotencyStore } from "../idempotency-store.js";

const MS_PER_SEC = 1_000;

interface CacheEntry {
  response: CachedResponse;
  expiresAt: number;
}

/** In-memory idempotency store for testing and development. */
export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly locks = new Map<string, number>();

  private compositeKey(accountId: string, key: string): string {
    return `${accountId}:${key}`;
  }

  async get(accountId: string, key: string): Promise<CachedResponse | null> {
    const entry = this.cache.get(this.compositeKey(accountId, key));
    if (!entry || Date.now() > entry.expiresAt) return null;
    return entry.response;
  }

  async set(accountId: string, key: string, response: CachedResponse): Promise<void> {
    this.cache.set(this.compositeKey(accountId, key), {
      response,
      expiresAt: Date.now() + IDEMPOTENCY_CACHE_TTL_SEC * MS_PER_SEC,
    });
  }

  async acquireLock(accountId: string, key: string): Promise<boolean> {
    const ck = this.compositeKey(accountId, key);
    const existing = this.locks.get(ck);
    if (existing && Date.now() < existing) return false;
    this.locks.set(ck, Date.now() + IDEMPOTENCY_LOCK_TTL_SEC * MS_PER_SEC);
    return true;
  }

  async releaseLock(accountId: string, key: string): Promise<void> {
    this.locks.delete(this.compositeKey(accountId, key));
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run --project api apps/api/src/__tests__/middleware/idempotency-store.test.ts > .tmp/idempotency-store-test2.txt 2>&1`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/middleware/idempotency-store.ts apps/api/src/middleware/idempotency.constants.ts apps/api/src/middleware/stores/memory-idempotency-store.ts apps/api/src/__tests__/middleware/idempotency-store.test.ts
git commit -m "feat(api): add idempotency store interface and in-memory implementation"
```

---

## Task 14: Valkey Idempotency Store

**Files:**
- Create: `apps/api/src/middleware/stores/valkey-idempotency-store.ts`
- Test: `apps/api/src/__tests__/middleware/valkey-idempotency-store.integration.test.ts`

- [ ] **Step 1: Write failing integration test**

Create `apps/api/src/__tests__/middleware/valkey-idempotency-store.integration.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ValkeyIdempotencyStore } from "../../middleware/stores/valkey-idempotency-store.js";
import type { CachedResponse } from "../../middleware/idempotency-store.js";

describe("ValkeyIdempotencyStore (integration)", () => {
  let store: ValkeyIdempotencyStore;

  beforeAll(async () => {
    const url = process.env.VALKEY_URL ?? "redis://localhost:6379";
    store = await ValkeyIdempotencyStore.create(url);
  });

  afterAll(async () => {
    await store.disconnect();
  });

  it("returns null for unknown key", async () => {
    const result = await store.get("test-account", `idem-${crypto.randomUUID()}`);
    expect(result).toBeNull();
  });

  it("stores and retrieves a cached response", async () => {
    const key = `idem-${crypto.randomUUID()}`;
    const cached: CachedResponse = { statusCode: 201, body: '{"data":{"id":"x"}}' };
    await store.set("test-account", key, cached);
    const result = await store.get("test-account", key);
    expect(result).toEqual(cached);
  });

  it("scopes keys by account", async () => {
    const key = `idem-${crypto.randomUUID()}`;
    const cached: CachedResponse = { statusCode: 201, body: '{"data":{"id":"x"}}' };
    await store.set("account-a", key, cached);
    const result = await store.get("account-b", key);
    expect(result).toBeNull();
  });

  it("acquires and releases locks", async () => {
    const key = `idem-${crypto.randomUUID()}`;
    expect(await store.acquireLock("test-account", key)).toBe(true);
    expect(await store.acquireLock("test-account", key)).toBe(false);
    await store.releaseLock("test-account", key);
    expect(await store.acquireLock("test-account", key)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project api-integration apps/api/src/__tests__/middleware/valkey-idempotency-store.integration.test.ts > .tmp/valkey-idem-test.txt 2>&1`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement Valkey idempotency store**

Create `apps/api/src/middleware/stores/valkey-idempotency-store.ts`:

```typescript
import {
  IDEMPOTENCY_CACHE_TTL_SEC,
  IDEMPOTENCY_KEY_PREFIX,
  IDEMPOTENCY_LOCK_PREFIX,
  IDEMPOTENCY_LOCK_TTL_SEC,
} from "../idempotency.constants.js";

import type { CachedResponse, IdempotencyStore } from "../idempotency-store.js";

/** Minimal Redis/Valkey client interface. */
interface ValkeyClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: string[]): Promise<unknown>;
  del(key: string): Promise<number>;
  ping(): Promise<string>;
  disconnect(): Promise<void>;
}

/** Valkey-backed idempotency store. */
export class ValkeyIdempotencyStore implements IdempotencyStore {
  private readonly client: ValkeyClient;

  private constructor(client: ValkeyClient) {
    this.client = client;
  }

  static async create(url: string): Promise<ValkeyIdempotencyStore> {
    const moduleName = "ioredis";
    const mod = (await import(moduleName)) as {
      default: new (url: string, opts: Record<string, unknown>) => ValkeyClient;
    };
    const client = new mod.default(url, { maxRetriesPerRequest: 3 });
    await client.ping();
    return new ValkeyIdempotencyStore(client);
  }

  private cacheKey(accountId: string, key: string): string {
    return `${IDEMPOTENCY_KEY_PREFIX}${accountId}:${key}`;
  }

  private lockKey(accountId: string, key: string): string {
    return `${IDEMPOTENCY_LOCK_PREFIX}${accountId}:${key}`;
  }

  async get(accountId: string, key: string): Promise<CachedResponse | null> {
    const raw = await this.client.get(this.cacheKey(accountId, key));
    if (!raw) return null;
    return JSON.parse(raw) as CachedResponse;
  }

  async set(accountId: string, key: string, response: CachedResponse): Promise<void> {
    await this.client.set(
      this.cacheKey(accountId, key),
      JSON.stringify(response),
      "EX",
      String(IDEMPOTENCY_CACHE_TTL_SEC),
    );
  }

  async acquireLock(accountId: string, key: string): Promise<boolean> {
    const result = await this.client.set(
      this.lockKey(accountId, key),
      "1",
      "EX",
      String(IDEMPOTENCY_LOCK_TTL_SEC),
      "NX",
    );
    return result === "OK";
  }

  async releaseLock(accountId: string, key: string): Promise<void> {
    await this.client.del(this.lockKey(accountId, key));
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run --project api-integration apps/api/src/__tests__/middleware/valkey-idempotency-store.integration.test.ts > .tmp/valkey-idem-test2.txt 2>&1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/middleware/stores/valkey-idempotency-store.ts apps/api/src/__tests__/middleware/valkey-idempotency-store.integration.test.ts
git commit -m "feat(api): add Valkey-backed idempotency store"
```

---

## Task 15: Idempotency Middleware

**Files:**
- Create: `apps/api/src/middleware/idempotency.ts`
- Test: `apps/api/src/__tests__/middleware/idempotency.test.ts`

- [ ] **Step 1: Write failing tests for idempotency middleware**

Create `apps/api/src/__tests__/middleware/idempotency.test.ts`:

```typescript
import { Hono } from "hono";
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryIdempotencyStore } from "../../middleware/stores/memory-idempotency-store.js";
import { createIdempotencyMiddleware, setIdempotencyStore } from "../../middleware/idempotency.js";
import { IDEMPOTENCY_KEY_HEADER } from "../../middleware/idempotency.constants.js";

describe("idempotency middleware", () => {
  let store: MemoryIdempotencyStore;
  let callCount: number;
  let app: Hono;

  beforeEach(() => {
    store = new MemoryIdempotencyStore();
    setIdempotencyStore(store);
    callCount = 0;

    app = new Hono();
    app.use("*", async (c, next) => {
      // Simulate auth context
      c.set("auth", { accountId: "acct-1" });
      return next();
    });
    app.post("/items", createIdempotencyMiddleware(), async (c) => {
      callCount++;
      return c.json({ data: { id: "new-item" } }, 201);
    });
  });

  it("passes through when no idempotency header", async () => {
    const res = await app.request("/items", { method: "POST" });
    expect(res.status).toBe(201);
    expect(callCount).toBe(1);
  });

  it("executes handler on first request with idempotency key", async () => {
    const res = await app.request("/items", {
      method: "POST",
      headers: { [IDEMPOTENCY_KEY_HEADER]: "key-1" },
    });
    expect(res.status).toBe(201);
    expect(callCount).toBe(1);
  });

  it("returns cached response on duplicate idempotency key", async () => {
    const headers = { [IDEMPOTENCY_KEY_HEADER]: "key-2" };
    await app.request("/items", { method: "POST", headers });
    const res = await app.request("/items", { method: "POST", headers });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ data: { id: "new-item" } });
    expect(callCount).toBe(1); // handler not called twice
  });

  it("rejects overly long idempotency key", async () => {
    const res = await app.request("/items", {
      method: "POST",
      headers: { [IDEMPOTENCY_KEY_HEADER]: "x".repeat(100) },
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run --project api apps/api/src/__tests__/middleware/idempotency.test.ts > .tmp/idempotency-mw-test.txt 2>&1`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement idempotency middleware**

Create `apps/api/src/middleware/idempotency.ts`:

```typescript
import { HTTP_BAD_REQUEST, HTTP_CONFLICT } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";

import {
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_KEY_MAX_LENGTH,
} from "./idempotency.constants.js";
import { MemoryIdempotencyStore } from "./stores/memory-idempotency-store.js";

import type { IdempotencyStore } from "./idempotency-store.js";
import type { MiddlewareHandler } from "hono";

/** Shared idempotency store, resolved at startup. */
let sharedStore: IdempotencyStore | undefined;

/** Set the shared idempotency store (call at startup). */
export function setIdempotencyStore(store: IdempotencyStore): void {
  sharedStore = store;
}

/** Reset the shared store (for testing). */
export function _resetIdempotencyStoreForTesting(): void {
  sharedStore = undefined;
}

/**
 * Idempotency key middleware for POST-create endpoints.
 *
 * When an `Idempotency-Key` header is present:
 * 1. If a cached response exists, return it immediately
 * 2. If the key is in-flight (locked), return 409 IDEMPOTENCY_CONFLICT
 * 3. Otherwise, acquire lock, execute handler, cache response, release lock
 *
 * When the header is absent, the request proceeds normally (opt-in).
 */
export function createIdempotencyMiddleware(): MiddlewareHandler {
  const fallbackStore = new MemoryIdempotencyStore();

  return async (c, next) => {
    const idempotencyKey = c.req.header(IDEMPOTENCY_KEY_HEADER);
    if (!idempotencyKey) return next();

    if (idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "VALIDATION_ERROR",
        `Idempotency-Key must be at most ${String(IDEMPOTENCY_KEY_MAX_LENGTH)} characters`,
      );
    }

    const store = sharedStore ?? fallbackStore;
    const auth = c.get("auth") as { accountId: string };
    const accountId = auth.accountId;

    // 1. Check cache
    const cached = await store.get(accountId, idempotencyKey);
    if (cached) {
      return new Response(cached.body, {
        status: cached.statusCode,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Acquire lock
    const acquired = await store.acquireLock(accountId, idempotencyKey);
    if (!acquired) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "IDEMPOTENCY_CONFLICT",
        "A request with this idempotency key is already in progress",
      );
    }

    try {
      // 3. Execute handler
      await next();

      // 4. Cache response
      const response = c.res;
      const body = await response.clone().text();
      await store.set(accountId, idempotencyKey, {
        statusCode: response.status,
        body,
      });
    } finally {
      await store.releaseLock(accountId, idempotencyKey);
    }
  };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run --project api apps/api/src/__tests__/middleware/idempotency.test.ts > .tmp/idempotency-mw-test2.txt 2>&1`
Expected: PASS

- [ ] **Step 5: Run full typecheck**

Run: `pnpm typecheck > .tmp/typecheck-task15.txt 2>&1`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/middleware/idempotency.ts apps/api/src/__tests__/middleware/idempotency.test.ts
git commit -m "feat(api): add idempotency key middleware"
```

---

## Task 16: Wire Idempotency Store at Startup

**Files:**
- Modify: `apps/api/src/index.ts` (or wherever `createValkeyStore` is called at startup)

- [ ] **Step 1: Find the startup wiring for Valkey**

The existing pattern is in `apps/api/src/index.ts` (or startup file) where `createValkeyStore()` is called and passed to `setRateLimitStore()`. Follow the same pattern.

- [ ] **Step 2: Wire idempotency store at startup**

After the existing `setRateLimitStore` call, add:

```typescript
import { ValkeyIdempotencyStore } from "./middleware/stores/valkey-idempotency-store.js";
import { setIdempotencyStore } from "./middleware/idempotency.js";

// In startup function, after Valkey rate-limit store setup:
if (env.VALKEY_URL) {
  try {
    const idempotencyStore = await ValkeyIdempotencyStore.create(env.VALKEY_URL);
    setIdempotencyStore(idempotencyStore);
  } catch (error) {
    logger.warn("Failed to create Valkey idempotency store, using in-memory fallback", {
      err: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck > .tmp/typecheck-task16.txt 2>&1`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat(api): wire idempotency store at startup"
```

---

## Task 17: Wire Idempotency Middleware on POST-Create Routes

**Files:**
- Modify: Route index files for all domains that have POST-create (201) endpoints

- [ ] **Step 1: Identify all POST-create route registrations**

These are routes that return `HTTP_CREATED` (201). Wire `createIdempotencyMiddleware()` on each. The middleware is applied at the route level, before the handler.

In each route's index.ts (or the create route file), add:

```typescript
import { createIdempotencyMiddleware } from "../../middleware/idempotency.js";

// On the create route, add middleware:
createRoute.use("*", createIdempotencyMiddleware());
```

Apply to all POST-create routes across all domains:
- `auth/register.ts`, `auth/biometric.ts` (enroll), `auth/recovery-key.ts` (regenerate)
- `account/pin/set-pin.ts` (if it returns 201)
- `account/friend-codes/create.ts`, `account/friend-codes/redeem.ts`
- `account/friends/create.ts` (friend request)
- `systems/create.ts`, `systems/duplicate.ts`
- `systems/settings/pin/set-pin.ts` (if 201), `systems/snapshots/create.ts`
- `members/create.ts`, `members/duplicate.ts`, `members/photos/create.ts`
- `groups/create.ts`, `groups/copy.ts`
- `fronting-sessions/create.ts`, `fronting-sessions/comments/create.ts`
- `fronting-reports/create.ts`, `custom-fronts/create.ts`
- `channels/create.ts`, `messages/create.ts`, `board-messages/create.ts`
- `notes/create.ts`, `polls/create.ts`, `polls/cast-vote.ts`
- `acknowledgements/create.ts`
- `structure/entities/create.ts`, `structure/entity-types/create.ts`
- `structure/entity-links/create.ts`, `structure/entity-member-links/create.ts`
- `structure/entity-associations/create.ts`
- `innerworld/entities/create.ts`, `innerworld/regions/create.ts`
- `relationships/create.ts`
- `fields/create.ts`
- `buckets/create.ts`, `buckets/rotations/initiate.ts`
- `blobs/upload-url.ts`
- `webhook-configs/create.ts`
- `timer-configs/create.ts`
- `device-tokens/register.ts`
- `api-keys/create.ts`
- `check-in-records/create.ts`
- `lifecycle-events/create.ts`

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck > .tmp/typecheck-task17.txt 2>&1`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(api): wire idempotency middleware on all POST-create routes"
```

---

## Task 18: Idempotency E2E Tests

**Files:**
- Create: `apps/api-e2e/src/tests/idempotency/idempotency.spec.ts`

- [ ] **Step 1: Write E2E tests for idempotency**

Create `apps/api-e2e/src/tests/idempotency/idempotency.spec.ts`:

```typescript
import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";

test.describe("Idempotency Keys", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("POST with idempotency key returns same response on retry", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const membersUrl = `/v1/systems/${systemId}/members`;
    const idempotencyKey = crypto.randomUUID();
    const encryptedData = encryptForApi({ name: "Idempotency Test" });

    const first = await request.post(membersUrl, {
      headers: { ...authHeaders, "idempotency-key": idempotencyKey },
      data: { encryptedData },
    });
    expect(first.status()).toBe(201);
    const firstBody = await first.json();

    const second = await request.post(membersUrl, {
      headers: { ...authHeaders, "idempotency-key": idempotencyKey },
      data: { encryptedData },
    });
    expect(second.status()).toBe(201);
    const secondBody = await second.json();

    // Same response replayed — same member ID
    expect(secondBody.data.id).toBe(firstBody.data.id);
  });

  test("POST without idempotency key creates new resource each time", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const membersUrl = `/v1/systems/${systemId}/members`;
    const encryptedData = encryptForApi({ name: "No-Idem Test" });

    const first = await request.post(membersUrl, {
      headers: authHeaders,
      data: { encryptedData },
    });
    const second = await request.post(membersUrl, {
      headers: authHeaders,
      data: { encryptedData },
    });

    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(firstBody.data.id).not.toBe(secondBody.data.id);
  });

  test("rejects overly long idempotency key", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const membersUrl = `/v1/systems/${systemId}/members`;
    const encryptedData = encryptForApi({ name: "Long Key Test" });

    const res = await request.post(membersUrl, {
      headers: { ...authHeaders, "idempotency-key": "x".repeat(100) },
      data: { encryptedData },
    });
    expect(res.status()).toBe(400);
  });
});
```

- [ ] **Step 2: Run E2E tests**

Run: `pnpm test:e2e > .tmp/e2e-task18.txt 2>&1`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api-e2e/src/tests/idempotency/idempotency.spec.ts
git commit -m "test(e2e): add idempotency key E2E tests"
```

---

## Task 19: Cleanup — Remove Old Response Helpers

**Files:**
- Verify: `apps/api/src/lib/response.ts` — should only contain `envelope()`
- Verify: No remaining `wrapResult`/`wrapAction`/`ActionResult` references

- [ ] **Step 1: Verify no remaining references**

Run: `grep -r "wrapResult\|wrapAction\|ActionResult" apps/api/src/ packages/types/src/ apps/api-e2e/src/ --include="*.ts" | grep -v node_modules`
Expected: No matches. If any remain, fix them.

- [ ] **Step 2: Verify response.ts is clean**

Read `apps/api/src/lib/response.ts` — should contain only the `envelope()` function.

- [ ] **Step 3: Verify no raw c.json() calls without envelope in routes**

Run: `grep -rn "return c.json(" apps/api/src/routes/ --include="*.ts" | grep -v "envelope(" | grep -v "c.body("`

Matches are acceptable ONLY in:
- **List routes** returning `PaginatedResult` directly (already has `data` at top level) — e.g., `members/list.ts`, `groups/list.ts`
- Any other match without `envelope()` needs fixing.

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git add -A
git commit -m "chore(api): clean up remaining response helper references"
```

---

## Task 20: Full Verification and Final Consistency Audit

**Files:** None (verification only)

- [ ] **Step 1: Run full typecheck**

Run: `pnpm typecheck > .tmp/typecheck-final.txt 2>&1`
Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `pnpm test:unit > .tmp/unit-final.txt 2>&1`
Run: `pnpm test:integration > .tmp/integration-final.txt 2>&1`
Run: `pnpm test:e2e > .tmp/e2e-final.txt 2>&1`
All must PASS.

- [ ] **Step 3: Audit error response consistency**

Run: `grep -rn "c.json(" apps/api/src/middleware/error-handler.ts --include="*.ts"`
Verify all error responses go through `formatError()` which produces `{ error: { code, message, details? }, requestId }`.

Run: `grep -rn "\"INTERNAL_ERROR\"\|\"VALIDATION_ERROR\"\|\"NOT_FOUND\"" apps/api/src/ --include="*.ts" | grep -v "api-constants\|error-handler\|__tests__" | head -20`
Verify no inline error code strings bypass `API_ERROR_CODES`.

- [ ] **Step 4: Audit path segment naming**

Run: `grep -rn "app.route\|new Hono" apps/api/src/routes/ --include="*.ts" | grep -v "index.ts" | head -30`
Verify all path segments use kebab-case.

- [ ] **Step 5: Audit response field casing**

Spot-check 5 service files for snake_case fields in return types:
Run: `grep -rn "snake_case_field\|_id\b\|_at\b\|_count\b" apps/api/src/services/ --include="*.ts" | grep -v "system_id\|account_id" | head -20`
(Note: database column names may use snake_case internally, but mapped results should use camelCase)

- [ ] **Step 6: Audit HTTP status codes**

Run: `grep -rn "HTTP_CREATED\|HTTP_OK\|HTTP_NO_CONTENT" apps/api/src/routes/ --include="*.ts" | head -30`
Verify: POST-creates use `HTTP_CREATED` (201), deletes use `HTTP_NO_CONTENT` (204), reads/updates use implicit 200.

- [ ] **Step 7: Audit pagination shape**

Run: `grep -rn "\.items" apps/api/src/ apps/api-e2e/src/ --include="*.ts" | grep -v node_modules | grep -v "__tests__" | head -20`
Expected: No matches — all renamed to `.data`.

- [ ] **Step 8: Audit DELETE behavior**

Run: `grep -rn "delete\|DELETE" apps/api/src/routes/ --include="*.ts" -l`
Spot-check 3 delete routes to confirm they return `c.body(null, HTTP_NO_CONTENT)`.

- [ ] **Step 9: Fix any deviations found**

If any audit step finds issues, fix them in-place and run tests again.

- [ ] **Step 10: Run format and lint**

Run: `pnpm format:fix && pnpm lint:fix`
Run: `pnpm format && pnpm lint`
Expected: PASS with zero warnings

- [ ] **Step 11: Final commit if audit fixes were needed**

```bash
git add -A
git commit -m "fix(api): address final consistency audit findings"
```

---

## Task 21: Update Bean and Block OpenAPI Reconciliation

- [ ] **Step 1: Mark bean api-ibn2 as completed**

```bash
beans update api-ibn2 -s completed --body-append "## Summary of Changes\n\n- Added \`{ data: T }\` response envelope to all non-204 route responses\n- Renamed \`PaginatedResult.items\` to \`PaginatedResult.data\` for uniform key\n- Removed \`wrapResult()\`, \`wrapAction()\`, and \`ActionResult\` type\n- Added opt-in \`Idempotency-Key\` header infrastructure (Valkey-backed)\n- Wired idempotency middleware on all POST-create (201) endpoints\n- Paginated device tokens list endpoint\n- Verified all existing consistency (error shapes, naming, status codes, pagination)"
```

- [ ] **Step 2: Mark OpenAPI bean as blocked-by this work**

```bash
beans update api-398w --blocked-by api-ibn2
```

- [ ] **Step 3: Commit bean files**

```bash
git add .beans/
git commit -m "chore(beans): complete api-ibn2, block api-398w"
```
