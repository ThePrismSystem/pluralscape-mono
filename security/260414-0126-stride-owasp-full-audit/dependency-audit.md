# Dependency Audit — Pluralscape Full Audit

**Date:** 2026-04-14
**Tool:** `pnpm audit`
**Total Dependencies:** 1,415

## Results

```
{
  "vulnerabilities": {
    "info": 0,
    "low": 0,
    "moderate": 0,
    "high": 0,
    "critical": 0
  }
}
```

**No known vulnerabilities detected.**

## Supply Chain Protections

| Protection              | Status  | Details                                                               |
| ----------------------- | ------- | --------------------------------------------------------------------- |
| Frozen lockfile         | Enabled | `pnpm install --frozen-lockfile` in CI                                |
| CI dependency audit     | Enabled | `pnpm audit --audit-level=moderate` in CI pipeline                    |
| GitHub Actions pinning  | Enabled | All actions pinned by SHA256 digest                                   |
| Container image pinning | Enabled | PostgreSQL and Valkey CI images pinned by SHA256                      |
| Lockfile integrity      | Enabled | pnpm's content-addressable store validates package integrity          |
| Package install hooks   | Safe    | Only `prepare: "husky"` (git hooks); no dangerous postinstall scripts |

## Notable Dependencies

| Package                 | Purpose        | Security Relevance                                   |
| ----------------------- | -------------- | ---------------------------------------------------- |
| libsodium-wrappers-sumo | Cryptography   | Core crypto provider (XChaCha20, X25519, Argon2id)   |
| drizzle-orm             | Database       | SQL parameterization (injection prevention)          |
| hono                    | HTTP framework | Request handling, middleware pipeline                |
| zod                     | Validation     | Input sanitization on all endpoints                  |
| @t3-oss/env-core        | Environment    | Typed env var validation with production enforcement |
| ioredis                 | Valkey/Redis   | Rate limiting, pub/sub, session revocation           |
| clarinet                | JSON parsing   | SP import file parsing (SAX-style)                   |
