# ADR 032: tRPC Parity Enforcement

## Status

Accepted

## Context

tRPC serves as the internal typed API for the Pluralscape mobile client (ADR 003). Both tRPC and REST transports delegate to the same service layer, but each configures its own middleware stack independently. Without active enforcement, the two transports drift in their security and operational properties.

A comprehensive audit (PR #356) discovered a concrete gap: only 2 of 35 tRPC routers had rate limits applied, while 100% of REST routes had correct rate limiting. Left unaddressed, this would expose the tRPC surface to unauthenticated or high-frequency abuse that the REST surface already protects against.

The audit fixed all gaps across five parity dimensions: procedure existence, rate limit categories, authentication levels, input validation schemas, and idempotency markers. A prevention mechanism is needed so these gaps cannot silently re-emerge as new endpoints are added.

## Decision

Parity between tRPC and REST is enforced through a combination of automated and manual controls:

**Automated CI check (`pnpm trpc:parity`)** — a script at `apps/api/scripts/check-trpc-parity.ts` verifies five dimensions for every procedure:

1. **Procedure existence** — every REST route has a tRPC equivalent, unless explicitly allowlisted
2. **Rate limit categories** — matching rate limit middleware (readDefault, readHeavy, write, authHeavy, authLight, blobUpload, auditQuery, friendCodeRedeem)
3. **Auth levels** — matching public / protected / system-scoped configuration
4. **Input validation** — every mutating procedure uses a validation schema imported from `@pluralscape/validation`
5. **Idempotency** — procedures annotated where the REST layer uses idempotency keys

**REST-only allowlist (`apps/api/scripts/trpc-parity.config.ts`)** — endpoints intentionally without tRPC equivalents are documented with an explicit reason. Current entries: root status (`GET /`), health check (`GET /health`), and the SSE notifications stream (`GET /v1/notifications/stream`). Adding a new exception requires a documented entry in the allowlist; the CI script rejects undocumented gaps.

**Manual response shape audit (per milestone)** — response shape parity is not checked by the script. Since both transports call the same service layer, structural drift is low-risk, but a manual audit is performed at each milestone release to catch any divergence introduced by transport-specific transformations.

**tRPC idempotency deferred** — tRPC procedures do not implement idempotency keys. This is intentional: idempotency keys are a REST pattern for unreliable clients. The mobile client uses React Query, which handles deduplication and retry at the call site. Applying REST-style idempotency to tRPC would add complexity without addressing any real failure mode.

## Consequences

- Every new endpoint requires both a REST route and a tRPC procedure. The CI check enforces this; new REST routes without tRPC equivalents fail the parity check unless added to the allowlist.
- Middleware configuration (rate limits, auth) must be applied identically on both transports. The CI check catches mismatches.
- The REST-only allowlist is the canonical record of intentional divergence. Reviewers can assess any new allowlist entry at code review time.
- Response shape parity remains a manual concern. The risk is low because both transports use the same service return values, but the manual audit step must not be skipped at milestone boundaries.
- tRPC idempotency remains out of scope unless React Query's retry semantics prove insufficient for a specific mutation.
