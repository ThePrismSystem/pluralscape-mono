---
# ps-nbap
title: "Fix PR #201 review findings"
status: completed
type: task
priority: normal
created_at: 2026-03-20T17:29:35Z
updated_at: 2026-04-16T07:29:46Z
parent: ps-afy4
---

Fix all issues found in PR #201 review: CI action versions, renovate automerge scope, commitlint script, env validation improvements, boolean transforms, middleware env migration, dead test mock removal, and test env mock migration.

## Summary of Changes

- **CI**: Fixed action versions (checkout@v6 -> v4, setup-node@v6 -> v4), added `needs: [lint, typecheck]` to security job
- **Renovate**: Scoped automerge to devDependencies only
- **Commitlint**: Changed from `--from=HEAD~1` to `--from=origin/main --to=HEAD` for branch-wide validation
- **env.ts**: Added boolean transforms for TRUST_PROXY/DISABLE_RATE_LIMIT/BLOB_STORAGE_S3_FORCE_PATH_STYLE, production refine for EMAIL_HASH_PEPPER, URL validation for S3 endpoint and Valkey URL, simplified runtimeEnv
- **index.ts**: Updated boolean call sites to use transformed values
- **7 middleware/lib files**: Migrated from `process.env` to `env` imports (cors, rate-limit, secure-headers, error-handler, origin-validation, request-meta, email-hash)
- **3 dead mocks removed**: Deleted `vi.mock("systems.constants.js")` from nomenclature, system-settings, and setup service tests
- **10 test files updated**: Migrated from process.env save/restore to `vi.hoisted` env mock pattern (cors, rate-limit, secure-headers x2, error-handler, origin-validation, email-hash, middleware-composition, auth.service, audit-writer)
