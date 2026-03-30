# API Consistency Normalization Design

**Bean:** `api-ibn2`
**Parent:** Public REST API audit (`api-e7gt`)
**Date:** 2026-03-30

## Goal

Normalize the API response surface for consistency ahead of public release. Pre-production — breaking changes are acceptable.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Response envelope | `{ data: T }` for all success responses | Future-proof — adding top-level metadata later is non-breaking |
| Pagination field name | Rename `items` → `data` | Uniform `data` key across single and list responses |
| List response shape | `{ data: T[], nextCursor, hasMore, totalCount }` | Keep existing pagination mechanics, just rename field |
| Action responses | Same `{ data: T }` envelope, drop `success: true` | 2xx status already signals success; `success: true` is redundant |
| No-content responses | 204 with no body (DELETE, logout) | No envelope needed when there's no content |
| DELETE idempotency | Keep 404 on already-deleted | Industry standard (GitHub, Stripe); catches client bugs |
| POST idempotency | `Idempotency-Key` header, opt-in, Valkey-backed | Safe retries for resource creation over unreliable networks |
| OpenAPI spec updates | Deferred to `api-398w` | Single reconciliation pass after normalization is cleaner |

## Current State

- **233 routes** (84%) return raw `c.json(result)` — no envelope
- **16 calls** use `wrapResult()`/`wrapAction()` — inconsistent envelope
- **40 list endpoints** use `PaginatedResult<T>` with `items` field
- **~640 test references** to `.items` across ~100+ test files
- Error responses, error codes, path naming, field casing, status codes, and pagination mechanics are already consistent

## Design

### 1. Response Envelope

All successful responses use a `{ data: T }` envelope:

| Pattern | Shape | Status Code |
|---------|-------|-------------|
| Single resource (GET, PUT) | `{ data: { id, name, ... } }` | 200 |
| Created resource (POST) | `{ data: { id, name, ... } }` | 201 |
| List (GET) | `{ data: T[], nextCursor, hasMore, totalCount }` | 200 |
| No content (DELETE, logout) | No body | 204 |
| Actions (revoke, PIN, setup) | `{ data: { ...result } }` | 200 |

**Implementation:**

- Create `envelope<T>(data: T): { data: T }` helper replacing `wrapResult`/`wrapAction`
- Migrate all `c.json(result, status)` calls to `c.json(envelope(result), status)`
- Rename `items` → `data` in `PaginatedResult<T>` type (`packages/types/src/pagination.ts`)
- Update `buildPaginatedResult()` and `buildCompositePaginatedResult()` in `apps/api/src/lib/pagination.ts`
- Remove `wrapResult()`, `wrapAction()`, and all `success: true` fields
- 204 responses (`c.body(null, 204)`) remain unchanged

### 2. Idempotency Keys

Opt-in idempotency for all POST endpoints that create resources (return 201). Not needed for PUT (OCC version handles it), DELETE (404 on repeat is acceptable), or POST endpoints that are actions rather than creates (login, logout, setup steps, PIN operations — these return 200 or 204, not 201).

**Client contract:**

- Send `Idempotency-Key: <client-generated-uuid>` header on POST requests
- If header absent: request proceeds normally
- If header present + first request: execute normally, cache response
- If header present + cached: return cached response (same status code and body)
- If header present + in-flight: return 409 `IDEMPOTENCY_CONFLICT`

**Storage (Valkey):**

```
idempotency:{accountId}:{key} → { statusCode, body, createdAt }  TTL: 24h
idempotency:lock:{accountId}:{key} → 1                           TTL: 30s
```

Keys are scoped per account — different accounts can use the same key string. Key reuse with a different endpoint or body returns the cached response (client's contract to manage keys).

**Middleware:**

Hono middleware applied to POST routes:

1. Check for `Idempotency-Key` header — if absent, pass through
2. Check Valkey for cached response — if found, return it
3. Attempt to acquire lock — if held, return 409
4. Execute handler, store response in Valkey, release lock
5. On server crash: lock TTL (30s) expires, client can retry

### 3. Device Tokens List Pagination

The device tokens list endpoint currently returns `{ data: tokens }` as a raw array. Migrate to standard `PaginatedResult` with `{ data, nextCursor, hasMore, totalCount }`.

### 4. Cleanup

After all migrations:

- Remove `wrapResult()` and `wrapAction()` helper functions
- Verify no raw `c.json()` calls remain in route handlers (all should use `envelope()`)

## Migration Strategy

### Approach: Audit First, Fix in Domain Batches

**Phase 1 — Audit:** Codify the agent research into a per-route checklist of deviations.

**Phase 2 — Shared infrastructure:**

- `envelope()` helper
- `PaginatedResult.items` → `PaginatedResult.data` rename (type + builders)
- Idempotency key middleware + Valkey storage

**Phase 3 — Domain batch migration:**

Each batch: wrap routes with `envelope()`, wire idempotency on POST creates, update tests.

| Batch | Domain | Notes |
|-------|--------|-------|
| 1 | Auth & Account | Login, register, sessions, PIN — foundational |
| 2 | Systems & Setup | Already uses wrapResult/wrapAction — normalize |
| 3 | Members & Groups | High traffic, many tests |
| 4 | Fronting | Complex lifecycle |
| 5 | Communication | Channels, messages, notes, polls |
| 6 | Structure | Entities, links, innerworld |
| 7 | Fields & Buckets | Custom fields, privacy |
| 8 | Blobs, Webhooks, Timers, Notifications | Remaining |
| 9 | Device Tokens | Add pagination to list endpoint |

**Phase 4 — Cleanup:** Remove `wrapResult`/`wrapAction`, verify no raw `c.json()` in routes.

**Phase 5 — Final consistency audit:** Verify the "already consistent" items weren't broken and no pre-existing deviations were missed:

- Error response shape: all errors go through global error handler
- Error code naming: all codes SCREAMING_SNAKE_CASE, no inline strings
- Path segments: all kebab-case
- Response field casing: spot-check for snake_case leaks
- HTTP status codes: no misuse (200 for creates, 201 for updates, etc.)
- Pagination: all list endpoints use `{ data, nextCursor, hasMore, totalCount }`
- DELETE behavior: all return 204/404 consistently

Fix any deviations found in-place.

## Testing Strategy

**Envelope wrapping:**

- Route-level tests: `response.body.someField` → `response.body.data.someField`
- Integration tests calling services directly: no changes (services return raw data)
- E2E tests: primary risk — assert on HTTP response shapes

**`items` → `data` rename:**

- Bulk find-and-replace across test files
- TypeScript compiler catches any missed references (type changes, `.items` becomes a type error)
- ~640 references across ~100+ test files

**Idempotency keys:**

- Unit tests: middleware logic (cache miss, cache hit, concurrent lock, expired key, missing header)
- Integration tests: Valkey store/retrieve/TTL/lock behavior
- E2E tests: at least one POST endpoint (member create) verifying replay

**Execution order per batch:**

1. Make changes
2. `pnpm typecheck` — catches `.items` and envelope shape mismatches
3. Domain-specific unit + integration tests
4. E2E tests
5. Full suite after all batches complete

## Out of Scope

These are already consistent and require no changes (verified in final audit):

- Error response shape: `{ error: { code, message, details? }, requestId }`
- Error code naming: SCREAMING_SNAKE_CASE
- Path segment naming: kebab-case
- Response field casing: camelCase
- HTTP status codes: 201/200/204 used correctly
- Pagination mechanics: cursor-based, max limit 100
- DELETE behavior: 404 on already-deleted

## Related Beans

- `api-398w` (OpenAPI spec reconciliation) — should be blocked-by this bean
