# ADR 033: PluralKit API Client Library

## Status

Accepted

## Context

The PluralKit import (M9 epic ps-dvxb) and bridge (ps-zs93) features require interaction with PluralKit's REST API v2. We evaluated two approaches:

1. **Custom HTTP client** — following the Simply Plural import pattern, build a bespoke client with retry/backoff logic.
2. **pkapi.js** — adopt the community-maintained TypeScript library that wraps PK's API v2.

PluralKit enforces stricter rate limits than Simply Plural (GET: 10/sec, POST/PATCH/DELETE: 3/sec), and 429 responses include a `retry_after` field the client must honour.

## Decision

Adopt pkapi.js (BSD 2-Clause license, https://github.com/greys-tools/pkapi.js).

Rationale:

- Built-in rate limiting with 429 backoff — avoids reimplementing PK's specific rate-limit scopes (`generic_get`, `generic_update`).
- Full coverage of v2 endpoints (systems, members, groups, switches).
- BSD 2-Clause is AGPL-3.0 compatible — verified in license audit.
- Used behind the `PkApiSource` abstraction, so replacement requires changing one file.

Alternative rejected: custom HTTP client. More control, but duplicates rate limiting logic that pkapi.js already handles correctly. The cost of maintaining a bespoke PK client is not justified given a mature library exists.

## Consequences

- External dependency on a community library. If abandoned, BSD 2-Clause permits forking.
- pkapi.js returns `Map` objects rather than plain arrays — sources must convert.
- The library is pinned to a specific version; updates require validation against our Zod schemas.
