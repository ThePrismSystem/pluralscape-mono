---
# api-2qy8
title: E2E test coverage expansion
status: todo
type: task
priority: high
created_at: 2026-03-29T02:59:38Z
updated_at: 2026-03-29T03:03:12Z
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

- [ ] Inventory current E2E test coverage (endpoints covered vs. total)
- [ ] Identify all uncovered endpoints
- [ ] Write success-path E2E tests for uncovered endpoints
- [ ] Write auth rejection tests for every protected endpoint
- [ ] Write IDOR tests for every system-scoped endpoint
- [ ] Write pagination tests for list endpoints
- [ ] Write validation rejection tests for create/update endpoints
- [ ] Write rate limit tests for sensitive endpoints
- [ ] Write webhook lifecycle E2E tests
- [ ] Write error response shape tests
- [ ] All E2E tests pass
- [ ] Coverage report shows complete API surface

\n\n## Development Approach\n\nAll code must be written test-first using strict TDD (Red -> Green -> Refactor). Use `/tdd` workflow.
