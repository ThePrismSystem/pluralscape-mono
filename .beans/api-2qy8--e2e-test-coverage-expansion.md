---
# api-2qy8
title: E2E test coverage expansion
status: completed
type: task
priority: high
created_at: 2026-03-29T02:59:38Z
updated_at: 2026-03-31T12:05:02Z
parent: api-e7gt
blocked_by:
    - api-398w
    - api-g475
    - api-sojx
    - api-69ul
    - api-3b2d
---

Write E2E tests for every uncovered endpoint and every gap identified by the audit beans.

## Scope

Comprehensive E2E test coverage for the entire public REST API. Tests run in `apps/api-e2e/` using Playwright against a live API instance.

### Coverage Requirements

- Every endpoint has at least one success-path E2E test
- Every endpoint with auth has an unauthenticated rejection test
- Every endpoint with ownership checks has a cross-account rejection test (IDOR)
- Every list endpoint tests pagination (multiple pages, empty results)
- Every create endpoint tests validation rejection (bad input)
- Every delete endpoint tests the 409 HAS_DEPENDENTS guard (where applicable)
- Rate-limited endpoints test the 429 response

### Test Organization

- Group by feature area (auth, account, systems, members, groups, fronting, etc.)
- Each test file covers one resource or feature area
- Shared helpers for auth setup, resource creation, cleanup

### Security-Specific E2E Tests

- IDOR tests for every system-scoped resource
- Auth bypass attempts on protected endpoints
- Rate limit enforcement verification
- Error response shape verification (no information leakage)
- Session expiration behavior
- 2FA enforcement on protected operations

### Webhook-Specific E2E Tests

- Webhook CRUD lifecycle
- Webhook delivery on state changes
- Webhook secret rotation
- Webhook test/ping
- Delivery retry behavior

## Checklist

- [x] Inventory current E2E test coverage (endpoints covered vs. total)
- [x] Identify all uncovered endpoints
- [x] Write success-path E2E tests for uncovered endpoints
- [x] Write auth rejection tests for every protected endpoint
- [x] Write IDOR tests for every system-scoped endpoint
- [x] Write pagination tests for list endpoints
- [x] Write validation rejection tests for create/update endpoints
- [x] Write rate limit tests for sensitive endpoints
- [x] Write webhook lifecycle E2E tests
- [x] Write error response shape tests
- [x] All E2E tests pass
- [x] Coverage report shows complete API surface

\n\n## Development Approach\n\nAll code must be written test-first using strict TDD (Red -> Green -> Refactor). Use `/tdd` workflow.

## PR #329 Feature Completeness E2E Gaps

The following 17 feature areas added in PR #329 have zero E2E coverage. Each needs at minimum success-path, auth rejection, and IDOR tests:

### Account Management

- **Account deletion/purge** — DELETE with password confirmation, verify cascade
- **Account PIN** — set, verify, remove PIN; anti-timing attack behavior
- **Device transfer approval** — approve step in device transfer flow

### Social Features

- **Friend accept/reject** — accept/reject pending friend requests, status transitions
- **Friend dashboard sync** — projection endpoint with privacy bucket filtering
- **Friend codes** — pagination format changes (existing tests updated but new flows untested)

### API Keys

- **API key CRUD** — create (crypto vs metadata types), list with pagination, get, revoke (idempotent)

### Content Management

- **Poll vote update/delete/results** — update votes, delete votes, consensus results with veto counts
- **Check-in record restore** — restore archived check-in records
- **Lifecycle event update** — cursor-based updates with metadata validation
- **Member photo GET** — single photo retrieval endpoint
- **Device token update/delete** — platform/token updates, deletion

### System Features

- **System snapshots** — CRUD (create, list, get, delete) with trigger types
- **System duplication** — duplicate system with new name
- **System permanent purge** — password-confirmed permanent deletion

### Structure Entities (Innerworld)

- **Entity CRUD** — create, list, get, update, archive, restore, delete, hierarchy
- **Entity types** — create, list, get, update, archive, restore, delete
- **Entity associations** — create, list, delete
- **Entity links** — create, list, delete
- **Entity member links** — create, list, delete
- **Entity custom field values** — set/list for structure entities (reuses member field pattern)

### Key Rotation

- **Key rotation retry** — retry failed bucket rotation

### Groups

- **Group custom field values** — set/list for groups (reuses member field pattern)
- **Group list filters** — type filter on group list endpoint

## Summary of Changes

Comprehensive E2E test coverage expansion across the entire public REST API surface. Added tests for all 17 feature areas identified as gaps: account management (deletion, PIN, device transfer), social features (friend accept/reject, dashboard sync, friend codes), API keys, content management (polls, check-in restore, lifecycle events, member photos, device tokens), system features (snapshots, duplication, permanent purge), innerworld structure entities (CRUD, types, associations, links, member links, custom fields), key rotation retry, and group features (custom field values, list filters). Each area includes success-path, auth rejection, IDOR, pagination, and validation tests as applicable.
