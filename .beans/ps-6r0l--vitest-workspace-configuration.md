---
# ps-6r0l
title: Vitest workspace configuration
status: todo
type: task
priority: critical
created_at: 2026-03-08T13:36:31Z
updated_at: 2026-03-08T13:36:41Z
parent: ps-jvnm
---

Vitest monorepo workspace configuration for all packages

## Scope

- Vitest 3+ configuration using `projects` array (not deprecated `workspace`)
- Root vitest.config.ts with projects pointing to packages/_, apps/_
- Per-package: use `defineProject` (not `defineConfig`)
- Shared settings via vitest.shared.ts + mergeConfig
- Environment configuration:
  - jsdom for client-side packages (types, crypto client code)
  - node for server-side packages (db, api)
- Watch mode for development
- Integration with turbo (test caching via turbo task definition)
- Test command setup: pnpm test, pnpm test:unit, pnpm test:integration

## Acceptance Criteria

- [ ] Root vitest.config.ts with projects array
- [ ] Per-package defineProject configs
- [ ] Shared settings via vitest.shared.ts
- [ ] Environment correctly set per package
- [ ] turbo.json test task defined
- [ ] pnpm test / test:unit / test:integration scripts work
- [ ] Watch mode works for focused development
- [ ] Smoke test: at least one passing test in one package

## Research Notes

- Vitest 3+ deprecates workspace — use projects array
- Coverage/reporters must be root-level only
- Per-package configs use defineProject, NOT defineConfig

## References

- CLAUDE.md (Test commands, coverage targets)
