# Dependency Audit — Pluralscape

## pnpm audit

```
$ pnpm audit
No known vulnerabilities found
```

**Date:** 2026-03-17
**Total packages scanned:** All workspace packages
**Known CVEs:** 0

## Security-Critical Dependencies

| Package                         | Version | Purpose                                              | Notes                               |
| ------------------------------- | ------- | ---------------------------------------------------- | ----------------------------------- |
| libsodium-wrappers-sumo         | 0.8.2   | Cryptography (XChaCha20-Poly1305, Argon2id, Ed25519) | Well-maintained, actively developed |
| drizzle-orm                     | 0.45.1  | Database ORM (parameterized queries)                 | Active maintenance                  |
| postgres                        | 3.4.5   | PostgreSQL driver                                    | Active                              |
| better-sqlite3-multiple-ciphers | 12.6.2  | SQLCipher-enabled SQLite                             | Active                              |
| hono                            | 4.12.7  | HTTP framework                                       | Active, security-conscious team     |
| @trpc/server                    | 11.13.4 | Type-safe RPC                                        | Pinned version via pnpm overrides   |
| zod                             | 4.3.6   | Input validation                                     | Active                              |
| bullmq                          | 5.52.1  | Job queue                                            | Active                              |
| ioredis                         | 5.9.3   | Valkey/Redis client                                  | Active                              |
| @aws-sdk/client-s3              | 3.750.0 | S3 blob storage                                      | Active (AWS maintained)             |

## pnpm Overrides

The monorepo pins specific versions to ensure security:

```json
{
  "pnpm": {
    "overrides": {
      "@trpc/server": "11.13.4",
      "esbuild": ">=0.25.0",
      "flatted": ">=3.4.0"
    }
  }
}
```

These overrides ensure known-good versions are used across all workspace packages.

## Supply Chain Controls

| Control                               | Status                                                |
| ------------------------------------- | ----------------------------------------------------- |
| Frozen lockfile (`--frozen-lockfile`) | Enforced in CI                                        |
| Dependabot monitoring                 | Configured                                            |
| CodeQL static analysis                | Configured (`.github/codeql/codeql-config.yml`)       |
| pnpm overrides for transitive deps    | Active                                                |
| AGPL-3.0 license compatibility        | Verified (`docs/audits/001-license-compatibility.md`) |

## Recommendations

No immediate actions required. Continue monitoring via Dependabot and periodic `pnpm audit` runs.
