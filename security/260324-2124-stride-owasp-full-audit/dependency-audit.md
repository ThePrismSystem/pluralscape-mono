# Dependency Audit — Pluralscape 2026-03-24

## Summary

**Status:** Clean — 0 known vulnerabilities

```
$ pnpm audit --audit-level=low
No known vulnerabilities found
```

## Key Security Dependencies

| Package                           | Version | Purpose                                      | Status                     |
| --------------------------------- | ------- | -------------------------------------------- | -------------------------- |
| `libsodium-wrappers-sumo`         | Latest  | E2E encryption (XChaCha20, X25519, Argon2id) | Active, well-maintained    |
| `hono`                            | 4.12.8  | Web framework                                | Active, security-conscious |
| `drizzle-orm`                     | 0.45.1  | Type-safe ORM (prevents SQL injection)       | Active                     |
| `postgres`                        | 3.4.5   | PostgreSQL client                            | Active                     |
| `zod`                             | 4.3.6   | Runtime validation                           | Active                     |
| `pino`                            | 10.0.0  | Structured logging                           | Active                     |
| `ioredis`                         | 5.10.1  | Redis/Valkey client (BullMQ)                 | Active                     |
| `@aws-sdk/client-s3`              | Latest  | S3/MinIO blob storage                        | Active                     |
| `better-sqlite3-multiple-ciphers` | ^12.6.2 | SQLite with encryption                       | Active                     |

## Security-Conscious Overrides

The root `package.json` applies pnpm overrides for transitive dependency security:

```json
{
  "@trpc/server": "11.15.0",
  "better-sqlite3": "npm:better-sqlite3-multiple-ciphers@^12.6.2",
  "ioredis": "5.10.1",
  "esbuild": ">=0.25.0",
  "fast-xml-parser": ">=5.5.7",
  "flatted": ">=3.4.2"
}
```

These ensure patched versions of vulnerable transitive dependencies.

## CI Enforcement

- `pnpm audit --audit-level=moderate` runs on every push/PR
- Frozen lockfile enforced (`--frozen-lockfile`)
- Renovate configured with weekly updates and SHA-pinned GitHub Actions
- Container images pinned to SHA digests

## Postinstall Script Audit

Only `napi-postinstall@0.3.4` found (native binding helper). No suspicious lifecycle scripts in any workspace package.
