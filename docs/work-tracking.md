# Work Tracking

This project uses [beans](https://github.com/btvnlue/beans), a local-first issue tracker that stores issues as markdown files in `.beans/`. Beans are committed alongside code — no external issue tracker needed.

## Quick Reference

```bash
beans list --json              # List all beans
beans list --json --ready      # Beans ready to start (not blocked, not in-progress/completed/scrapped/draft)
beans show --json <id>         # View bean details
beans create "Title" -t <type> # Create a bean
beans update <id> -s <status>  # Update status
```

## Types

| Type        | Purpose                                                                         |
| ----------- | ------------------------------------------------------------------------------- |
| `milestone` | A release target or checkpoint (e.g., "v0.1.0 Alpha"). Children are epics       |
| `epic`      | A thematic group of related work. Always has children, never worked on directly |
| `feature`   | A user-facing capability or enhancement                                         |
| `task`      | A concrete piece of work (chore, sub-task, technical debt)                      |
| `bug`       | Something that is broken and needs fixing                                       |

## Statuses

| Status        | Meaning                          |
| ------------- | -------------------------------- |
| `draft`       | Needs refinement before starting |
| `todo`        | Ready to be worked on            |
| `in-progress` | Currently being worked on        |
| `completed`   | Finished successfully            |
| `scrapped`    | Will not be done                 |

## Priorities

`critical` > `high` > `normal` (default) > `low` > `deferred`

## Domain Prefixes

Use `--prefix` to scope beans to a domain:

| Prefix    | Domain                             |
| --------- | ---------------------------------- |
| `ps-`     | Global / cross-cutting (default)   |
| `api-`    | API server (`apps/api`)            |
| `mobile-` | Mobile app (`apps/mobile`)         |
| `db-`     | Database (`packages/db`)           |
| `crypto-` | Encryption (`packages/crypto`)     |
| `sync-`   | CRDT sync (`packages/sync`)        |
| `types-`  | Shared types (`packages/types`)    |
| `client-` | API client (`packages/api-client`) |
| `infra-`  | CI/CD, tooling, devops             |

```bash
beans create "Add health check" -t feature --prefix api-
beans create "Fix key derivation" -t bug --prefix crypto-
beans create "Update CI matrix" -t task --prefix infra-
```

## Tags

Use tags for cross-cutting concerns that span domains:

```bash
beans create "Encrypt journal entries" -t feature --prefix crypto- --tag privacy --tag encryption
```

Common tags: `security`, `encryption`, `privacy`, `a11y`, `offline`, `performance`

## Hierarchy and Relationships

### Type hierarchy

```
milestone
  └── epic
       ├── feature
       ├── task
       └── bug
```

Set parent relationships with `--parent`:

```bash
beans create "Front tracking" -t epic --prefix ps-
beans create "Log a front" -t feature --prefix mobile- --parent ps-xxxx
```

### Epic conventions

Epics are containers — they organize related work but are never worked on directly.

1. Create epics in `draft` status. Move to `todo` once children are defined
2. An epic is `in-progress` when any child is `in-progress`
3. An epic is `completed` only when all children are `completed` or `scrapped`
4. Break work into feature/task/bug children — do not assign work directly to an epic
5. Epics typically use the `ps-` prefix since they often span domains

### Blocking relationships

Use `--blocked-by` when a bean cannot start until another finishes:

```bash
beans create "Build sync UI" -t feature --prefix mobile- --blocked-by sync-xxxx
```

Use `--blocking` when a bean blocks others:

```bash
beans update db-xxxx --blocking api-yyyy
```

## Workflow

1. **Before starting work**: check for an existing bean (`beans list --ready`). If none exists, create one
2. **While working**: keep the bean's checklist current (check off items as they're done)
3. **When committing**: include bean file changes in the commit
4. **When completing**: add a `## Summary of Changes` section, then set status to `completed`
5. **When scrapping**: add a `## Reasons for Scrapping` section, then set status to `scrapped`
6. **Deferred work**: always create a follow-up bean — never leave work undocumented
