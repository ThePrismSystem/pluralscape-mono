---
# ps-6lwp
title: Audit hand-rolled types across codebase; route to @pluralscape/types
status: todo
type: task
created_at: 2026-04-21T13:56:16Z
updated_at: 2026-04-21T13:56:16Z
parent: types-ltel
---

Sweep apps/api, apps/mobile, and every packages/\* (excluding packages/types itself) for local interface/type declarations that duplicate domain entity shapes, branded-ID shapes, or enum unions already exported from @pluralscape/types. Replace duplicates with imports from the types package; delete the local declarations.

## Context

Types-as-SoT works only if nothing outside packages/types is authoritatively defining the same shape. Grep patterns typical of drift: local interface X { id: string; systemId: string; ... } shapes that mirror published entity types; local type X = "foo" | "bar" unions that mirror published enum types; string or string & { \_\_brand: "X" } ad-hoc branded-ID attempts that duplicate packages/types/src/ids.ts.

## Scope

- [ ] Enumerate offenders via grep — suggested search patterns:
  - `interface \w+ \{[\s\S]*\bid:\s*(string|\w+Id)\b`
  - `type \w+Id = string`
  - `type \w+ = "` (for union-type drift)
  - Manual inspection of apps/api/src/services, apps/mobile/src/hooks, apps/mobile/src/features, packages/sync/src/strategies, packages/queue/src/adapters
- [ ] Produce a markdown checklist file at docs/local-audits/2026-04-21-hand-rolled-types-audit.md with file path + line + suggested replacement
- [ ] For each offender: replace with import from @pluralscape/types and delete the local declaration
- [ ] Track each fix as a `- [ ]` line in the audit file

## Out of scope

- Creating new entity-type pairs (sibling publish-pairs task handles this)
- Changing packages/types shapes (SoT hand-authored, this task only removes duplicates)
- Zod / Drizzle schema changes

## Acceptance

- Audit file committed with all offenders enumerated and every box checked
- pnpm typecheck + pnpm lint pass
- pnpm test:unit passes across affected packages

## Notes

Expect dozens of small fixes across mobile and service code. Consider breaking into per-package PRs if the total diff becomes unmanageable.
