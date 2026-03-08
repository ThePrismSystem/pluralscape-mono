---
# pluralscape-mono-940y
title: Monorepo scaffolding
status: completed
type: task
priority: normal
created_at: 2026-03-08T08:35:12Z
updated_at: 2026-03-08T08:51:22Z
---

Scaffold complete monorepo: workspace config, tooling packages, shared packages, apps, and git hooks

## Summary of Changes

Scaffolded the complete pnpm monorepo with:

- Root config: pnpm-workspace.yaml, turbo.json, package.json, .npmrc, .prettierignore, eslint.config.js
- Tooling packages: @pluralscape/tsconfig, @pluralscape/prettier-config, @pluralscape/eslint-config (with all code quality rules)
- Shared packages: types, db, crypto, sync, api-client (all with stubs)
- Apps: api (Hono on Bun), mobile (Expo with expo-router)
- Git hooks: husky pre-commit (lint-staged) and pre-push (typecheck + lint)
- .env.example with configurable ports (API_PORT=10045, MOBILE_WEB_PORT=10098)
- Verified: pnpm install, typecheck, lint, format all pass; API serves on configured port
