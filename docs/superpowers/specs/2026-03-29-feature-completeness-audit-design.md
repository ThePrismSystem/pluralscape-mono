# Feature Completeness Audit — Design Spec

**Bean:** api-g475
**Date:** 2026-03-29
**Parent epic:** api-e7gt (Public REST API audit)

---

## Goal

Cross-reference every feature from completed milestones (M1-M7) against API endpoints. Identify gaps where the API surface does not fully support the client app. Produce an audit document and actionable follow-up beans for every gap found.

## Exclusions

- **Import/export:** Client-side in M8 (zero-knowledge server). Not audited.
- **Switches:** Implicit in this project model (fronting sessions cover this). Not a standalone entity.

## Sources of Truth

Requirements are gathered from five sources. A capability is "required" if any source establishes it.

1. `docs/planning/features.md` — canonical feature list
2. Milestone scope docs in `docs/planning/` (M1-M7)
3. ADRs in `docs/adr/`
4. `CHANGELOG.md`
5. Completed beans (`.beans/` with status `completed`)

## Domains

The audit covers 15 feature domains:

| #   | Domain                           | Route directory / area                                                                                                      |
| --- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authentication                   | `auth/`                                                                                                                     |
| 2   | Account                          | `account/`                                                                                                                  |
| 3   | Systems                          | `systems/` (CRUD, settings, nomenclature, PIN, setup wizard)                                                                |
| 4   | Members                          | `members/` (CRUD, photos, relationships)                                                                                    |
| 5   | Groups                           | `groups/` (CRUD, tree, reorder, move, membership)                                                                           |
| 6   | System structure entities        | subsystems, side-systems, layers, structure links                                                                           |
| 7   | Custom fields                    | `fields/` (definitions + values across system, member, group, structure entity)                                             |
| 8   | Fronting                         | `fronting-sessions/`, `fronting-reports/`, `custom-fronts/`, `analytics/`                                                   |
| 9   | Communication                    | `channels/`, `messages/`, `board-messages/`, `notes/`, `polls/`, `acknowledgements/`                                        |
| 10  | Social                           | `account/friends/`, `account/friend-codes/`                                                                                 |
| 11  | Privacy                          | `buckets/` (CRUD, tags, key grants, friend assignments, export)                                                             |
| 12  | Innerworld                       | `innerworld/` (regions, entities, canvas)                                                                                   |
| 13  | Blobs                            | `blobs/` (upload, download, metadata)                                                                                       |
| 14  | Sync                             | WebSocket sync, CRDT operations                                                                                             |
| 15  | Webhooks, Notifications & Timers | `webhook-configs/`, `webhook-deliveries/`, `notification-configs/`, `device-tokens/`, `timer-configs/`, `check-in-records/` |

## Methodology

For each domain, follow five steps:

### Step 1 — Gather requirements

Read all five sources and compile a list of required capabilities. Each capability is a specific action the API must support (e.g., "create a member," "list fronting sessions filtered by date range").

### Step 2 — Map to existing routes

Read the domain's route index and individual route files. Record each endpoint: HTTP method, path, and purpose.

### Step 3 — Check list endpoints

For every list endpoint, verify:

- **Pagination:** cursor-based (limit + cursor params)
- **Filters:** relevant to the domain (e.g., by status, date range, member, type)
- **Sort:** options the client would need

### Step 4 — Identify gaps

Compare requirements against existing routes. Each gap gets:

- **Description:** what's missing
- **Severity:**
  - **Blocker** — client cannot function without it
  - **Medium** — degraded experience or missing expected functionality
  - **Low** — nice-to-have, not required for launch
- **Source:** which source document established the requirement

### Step 5 — Record findings

Write up the domain section in the audit document.

## Execution

Domain investigations will be parallelized with subagents where domains are independent. Each subagent audits one or more domains and returns structured findings. Results are assembled into the final document.

## Output

### Audit document

Location: `docs/local-audits/feature-completeness-audit-2026-03-29.md`

Structure:

1. **Summary table** — all 15 domains with coverage status (fully covered / partially covered / gaps found) and gap count
2. **Per-domain sections** — each containing:
   - Required capabilities (with source reference)
   - Existing endpoints (method, path, purpose)
   - Pagination/filtering assessment for list endpoints
   - Gaps with severity and description
3. **Gap summary** — consolidated list grouped by severity (blocker > medium > low)

### Follow-up beans

One bean per gap (or per logical cluster of tightly related gaps within a domain):

- **Type:** `task` or `feature` depending on scope
- **Prefix:** `api-`
- **Parent:** `api-e7gt` (Public REST API audit epic)
- **Priority mapping:** blocker gap -> critical, medium gap -> high, low gap -> normal

## Completion criteria for api-g475

- All 15 domains audited against all 5 sources
- Audit document written and committed
- Follow-up beans created for every identified gap
- All checklist items in the bean checked off
