# Dependency Audit — Pluralscape

## pnpm audit

**Run date:** 2026-03-15
**Total dependencies:** 976
**Advisories:** 0

```json
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

## Key Dependencies

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| hono | ^4.12.7 | HTTP framework | Well-maintained, Cloudflare-backed |
| drizzle-orm | ^0.45.1 | ORM | Parameterized queries prevent SQL injection |
| postgres | ^3.4.5 | PG client | Maintained by porsager |
| better-sqlite3-multiple-ciphers | ^12.6.2 | SQLite + SQLCipher | Fork with encryption support |
| libsodium-wrappers-sumo | ^0.8.2 | Cryptography | Maintained by jedisct1; sumo build includes all algorithms |
| @automerge/automerge | ^3.2.4 | CRDT library | For encrypted sync protocol |
| zod | ^4.3.6 | Schema validation | Used with tRPC (not yet implemented) |
| @trpc/server | ^11.0.0-rc.730 | API framework | RC version (pre-release) |

## Dependency Overrides

```json
{
  "esbuild": ">=0.25.0",
  "flatted": ">=3.4.0"
}
```

These overrides pin transitive dependencies to versions that resolve known issues.

## Dependabot Configuration

- **Schedule:** Weekly (Monday)
- **Ecosystems:** npm, GitHub Actions
- **Groups:** Dev dependencies grouped for minor/patch updates
- **PR limit:** 10 open PRs

## Observations

1. **@trpc/server is a release candidate** (rc.730). While not a security issue, RC versions may have breaking changes. Monitor for stable release.
2. **No lock file integrity verification** in CI beyond `pnpm install --frozen-lockfile`. Consider adding `npm audit --audit-level=moderate` to CI.
3. **All critical cryptographic operations** use libsodium, which is the gold standard for a NaCl/libsodium binding.
