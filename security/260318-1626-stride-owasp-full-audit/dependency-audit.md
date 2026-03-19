# Dependency Audit — Pluralscape

## Summary

**Date:** 2026-03-18
**Tool:** `pnpm audit`
**Result:** No known vulnerabilities found

## Package Manager

- **pnpm** with `--frozen-lockfile` in CI
- Dependabot enabled for automated dependency updates
- `pnpm-lock.yaml` committed and verified

## Key Security Dependencies

| Package                           | Version  | Purpose                                | Risk Level                 |
| --------------------------------- | -------- | -------------------------------------- | -------------------------- |
| `libsodium-wrappers-sumo`         | ^0.7.15  | Cryptographic primitives (WASM)        | Critical (well-maintained) |
| `postgres`                        | ^3.4.5   | PostgreSQL driver                      | High                       |
| `drizzle-orm`                     | ^0.45.1  | ORM with parameterized queries         | High                       |
| `hono`                            | ^4.12.7  | Web framework with security middleware | High                       |
| `@aws-sdk/client-s3`              | ^3.817.0 | S3 storage operations                  | Medium                     |
| `@aws-sdk/s3-request-presigner`   | ^3.817.0 | Presigned URL generation               | Medium                     |
| `bullmq`                          | ^5.52.1  | Job queue (Valkey/Redis)               | Medium                     |
| `ioredis`                         | 5.9.3    | Redis client                           | Medium                     |
| `better-sqlite3-multiple-ciphers` | ^12.6.2  | SQLCipher (encrypted SQLite)           | High                       |
| `zod`                             | ^4.3.6   | Input validation                       | Medium                     |

## Root `package.json` Overrides

These overrides pin specific versions to resolve known issues:

| Package           | Override | Reason                             |
| ----------------- | -------- | ---------------------------------- |
| `@trpc/server`    | 11.13.4  | Pinned to tested version           |
| `esbuild`         | >=0.25.0 | Minimum version for security fixes |
| `fast-xml-parser` | >=5.5.6  | Security fix (prototype pollution) |
| `flatted`         | >=3.4.0  | Security fix                       |

## CI/CD Security

- `pnpm install --frozen-lockfile` prevents dependency injection
- GitHub Actions with `contents: read` permission only
- No Docker build pipeline (pre-production)
- CodeQL analysis available via `pnpm codeql` (manual)

## Recommendations

1. Continue running `pnpm audit` in CI pipeline
2. Enable automated CodeQL scanning as a CI step
3. Consider adding SBOM generation for dependency tracking
4. Monitor `libsodium-wrappers-sumo` for any upstream advisories
