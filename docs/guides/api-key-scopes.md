# API Key Scopes Reference

API keys use a three-tier scope hierarchy to control access to Pluralscape endpoints. Scopes are set at key creation time and cannot be modified — revoke and recreate to change scopes.

## Scope Hierarchy

Each scope domain supports three tiers of access:

| Tier     | Grants                | Description                                 |
| -------- | --------------------- | ------------------------------------------- |
| `read`   | Read only             | List and get operations                     |
| `write`  | Read + Write          | Create, update, archive, restore operations |
| `delete` | Read + Write + Delete | Permanent deletion and purge operations     |

Higher tiers implicitly grant lower tiers. A key with `write:members` can also perform `read:members` operations.

## Scope Domains

| Domain             | Tier Scopes                                                                  | Covers                                           |
| ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| `members`          | `read:members`, `write:members`, `delete:members`                            | Member CRUD, photos, memberships                 |
| `fronting`         | `read:fronting`, `write:fronting`, `delete:fronting`                         | Fronting sessions, active fronters, comments     |
| `groups`           | `read:groups`, `write:groups`, `delete:groups`                               | Group CRUD, member assignments, reordering, tree |
| `system`           | `read:system`, `write:system`, `delete:system`                               | System profile, duplication, purge               |
| `structure`        | `read:structure`, `write:structure`, `delete:structure`                      | System structure entities (canvas)               |
| `reports`          | `read:reports`, `write:reports`, `delete:reports`                            | Fronting reports                                 |
| `webhooks`         | `read:webhooks`, `write:webhooks`, `delete:webhooks`                         | Webhook configs, secrets, test pings             |
| `blobs`            | `read:blobs`, `write:blobs`, `delete:blobs`                                  | Blob upload/download, confirmation               |
| `notifications`    | `read:notifications`, `write:notifications`, `delete:notifications`          | Device tokens, notification configs, stream      |
| `acknowledgements` | `read:acknowledgements`, `write:acknowledgements`, `delete:acknowledgements` | Acknowledgement CRUD                             |
| `channels`         | `read:channels`, `write:channels`, `delete:channels`                         | Communication channels                           |
| `messages`         | `read:messages`, `write:messages`, `delete:messages`                         | Channel messages                                 |
| `notes`            | `read:notes`, `write:notes`, `delete:notes`                                  | Journal notes                                    |
| `polls`            | `read:polls`, `write:polls`, `delete:polls`                                  | Polls and votes                                  |
| `relationships`    | `read:relationships`, `write:relationships`, `delete:relationships`          | Member relationships                             |
| `innerworld`       | `read:innerworld`, `write:innerworld`, `delete:innerworld`                   | Innerworld entities and canvas                   |
| `fields`           | `read:fields`, `write:fields`, `delete:fields`                               | Custom field definitions and values              |
| `check-ins`        | `read:check-ins`, `write:check-ins`, `delete:check-ins`                      | Check-in records                                 |
| `lifecycle-events` | `read:lifecycle-events`, `write:lifecycle-events`, `delete:lifecycle-events` | Custom lifecycle events                          |
| `timers`           | `read:timers`, `write:timers`, `delete:timers`                               | Timer configurations                             |
| `buckets`          | `read:buckets`, `write:buckets`, `delete:buckets`                            | Privacy buckets, rotations, friend assignments   |

### Special Domain

| Scope            | Description                                                                        |
| ---------------- | ---------------------------------------------------------------------------------- |
| `read:audit-log` | Read-only access to the audit log. No write or delete tier exists for this domain. |

## Aggregate Scopes

Aggregate scopes grant access across all domains at a given tier:

| Scope        | Grants                                                    |
| ------------ | --------------------------------------------------------- |
| `read-all`   | `read:*` on every domain (including `read:audit-log`)     |
| `write-all`  | `write:*` + `read:*` on every domain (write implies read) |
| `delete-all` | `delete:*` + `write:*` + `read:*` on every domain         |
| `full`       | All access, including API key management endpoints        |

**Note:** `full` is the only scope that grants access to API key management endpoints (`/api-keys` CRUD). This prevents privilege escalation — a key cannot create keys with broader scopes than its own unless it has `full`.

## Hierarchy Resolution

When an endpoint requires a scope, the server checks in this order:

1. If the key has `full` — allowed
2. Split the required scope into tier and domain (e.g., `write:members` — tier=write, domain=members)
3. For each tier at or above the required tier (write, delete):
   - Check if the key has the aggregate scope for that tier (`write-all`, `delete-all`)
   - Check if the key has the per-entity scope for that tier (`write:members`, `delete:members`)
4. If none match — denied (403 `FORBIDDEN` with message `Insufficient scope: requires <scope>`)

## Scope Count

- 21 domains x 3 tiers = 63 per-entity scopes
- 1 special scope: `read:audit-log`
- 4 aggregate scopes: `read-all`, `write-all`, `delete-all`, `full`
- **Total: 68 scopes**

## Common Scope Combinations

**Read-only integration** (dashboards, monitoring):

```
["read:members", "read:fronting", "read:groups"]
```

**Fronting tracker** (read system data, manage fronting):

```
["read:members", "read:groups", "write:fronting"]
```

**Full automation** (CI/CD, backup tooling):

```
["full"]
```

**Broad read with selective write:**

```
["read-all", "write:members", "write:fronting"]
```
