# API Security Audit Design

Combined security audit covering three beans:

- `api-sojx` — Authentication and authorization
- `api-69ul` — Input validation and error handling
- `api-3b2d` — Rate limiting, headers, and CORS

## Approach

Single-pass route-by-route sweep with automated inventory first, manual semantic review second. Low-hanging fruit fixed inline with TDD; larger issues become follow-up beans.

## Phase 1: Route Inventory Script

Permanent audit tool at `scripts/audit-routes.ts`. Statically analyzes route files (no runtime) to produce a table mapping every route to:

- Path and HTTP method
- Auth middleware presence (has `authMiddleware()` or not)
- Rate limit tier (which category, or "global only")
- Validation schema reference (has Zod schema or not)
- Body limit (custom or default)

Mechanically flags: routes missing auth, routes with no rate limit tier beyond global, routes with no validation schema.

Output: JSON suitable for piping to other tools or rendering as a table.

## Phase 2: Manual Route-by-Route Sweep

For each route, verify across all three audit dimensions:

### Auth/Authz (api-sojx)

- Ownership checks correct — `system_id` verified against authenticated account
- No IDOR — nested resources verify parent ownership, not just existence
- Unauthenticated routes (login, register, password-reset, recovery-key) don't leak data in error responses
- Session token lifecycle: entropy, expiration, revocation
- Password change / recovery key flows require current auth
- 2FA: time window, replay prevention, enrollment requires auth
- Device transfer: secure handoff, no token reuse
- Biometric auth: challenge-response integrity

### Validation/Errors (api-69ul)

- Zod schemas in service layer cover all accepted input (current pattern: `.safeParse()` in services)
- String, array, and numeric limits exist on all fields
- Path and query params validated (UUID format, etc.)
- No raw SQL construction (verify Drizzle ORM used consistently)
- No path traversal in blob/file operations
- No information leakage in 4xx error details (table names, query text, file paths)
- Error codes correct and consistent per endpoint
- Content-Type enforcement on request bodies

### Rate Limiting/Headers/CORS (api-3b2d)

- Rate limit tier appropriate for endpoint sensitivity
- Sensitive auth endpoints use `authHeavy` or tighter
- `DISABLE_RATE_LIMIT` cannot activate in production
- Security headers complete (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Permissions-Policy)
- `Cache-Control` on sensitive responses
- No `X-Powered-By` header
- CORS origins explicitly configured (already rejects bare `*`)
- `TRUST_PROXY` / `X-Forwarded-For` handling is safe

Findings recorded in `docs/local-audits/security-audit-2026-03-30.md`, organized by route, with severity tags (critical/high/medium/low).

## Phase 3: Fixes

### Fix inline (low-hanging fruit)

- Missing rate limit tier on a route
- Missing validation constraints on existing Zod schemas
- Incorrect error code or leaking detail in error responses
- Missing security headers
- `DISABLE_RATE_LIMIT` not guarded against production
- CORS configuration issues

### Create follow-up beans for

- Architectural changes (ownership check pattern rethink, middleware restructuring)
- Changes to the API contract (response shapes, error codes clients depend on)

### Test strategy

Each fix is written test-first (TDD):

- **Auth/authz fixes**: integration tests — attempt cross-account access, verify 401/403
- **Rate limit fixes**: unit tests for tier assignment, integration test for 429 response
- **Validation fixes**: unit tests for schema edge cases
- **Header fixes**: integration test asserting response headers

## Deliverables

| Bean | Deliverables |
|------|-------------|
| `api-sojx` | Auth middleware coverage map, IDOR findings, session/password/2FA audit, inline fixes + tests |
| `api-69ul` | Validation coverage map, injection audit, error handling audit, inline fixes + tests |
| `api-3b2d` | Rate limit tier map, security header audit, CORS audit, inline fixes + tests |
| Shared | `scripts/audit-routes.ts` (permanent), audit report in `docs/local-audits/`, follow-up beans |

One branch, one PR. Commits grouped by bean. Each bean completed with `## Summary of Changes`.
