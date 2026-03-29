---
# api-g475
title: Feature completeness audit
status: completed
type: task
priority: high
created_at: 2026-03-29T02:58:32Z
updated_at: 2026-03-29T21:32:17Z
parent: api-e7gt
---

Cross-reference every feature from completed milestones against API endpoints. Ensure the API surface supports the full client app.

## Scope

Walk every completed milestone (M1-M6) and the current M7 scope. For each feature:

- Verify corresponding REST endpoints exist and are functional
- Verify CRUD completeness (create/read/update/delete/list where applicable)
- Verify relationship management endpoints (e.g., member-group associations)
- Verify lifecycle endpoints (e.g., fronting start/end, switch)
- Verify bulk operations where the client needs them
- Verify export/import endpoints for data portability (M7)

Identify gaps and create follow-up beans for any missing endpoints.

## Feature Areas to Audit

- Authentication: register, login, sessions, password change, recovery key, biometric, device transfer, 2FA
- Account: settings, email, audit log, deletion/purge
- Systems: CRUD, settings, nomenclature, PIN
- Members: CRUD, custom fields, relationships, privacy buckets
- Groups: CRUD, membership management
- Fronting: start/end sessions, current fronters, history, analytics, custom fronts
- Communication: channels, messages, polls
- Social: friends, friend codes, privacy buckets, visibility
- Innerworld: locations, connections, map
- Blobs: upload, download, metadata, cleanup
- Sync: WebSocket, CRDT operations, conflict resolution
- Webhooks: CRUD, deliveries, rotation, test/ping (M7)
- Notifications: push subscription, delivery
- Timers: CRUD, triggers
- Custom fields: type definitions, values

## Checklist

- [x] Enumerate all features from M1-M7 scope documents
- [x] Map each feature to its API endpoints
- [x] Identify missing endpoints or incomplete CRUD sets
- [x] Identify missing query filters or sort options the client will need
- [x] Verify all list endpoints support the client's pagination needs
- [x] Document gaps with severity (blocker vs. nice-to-have)
- [x] Create follow-up beans for any missing functionality

## Summary of Changes

Completed feature completeness audit across 15 domains against 5 sources of truth (features.md, milestones.md, ADRs, CHANGELOG, 961 completed beans).

Audit document: docs/audits/feature-completeness-audit-2026-03-29.md

Findings: 52 gaps total (11 blocker, 24 medium, 17 low). 16 follow-up beans created under parent api-e7gt (5 critical, 10 high, 1 normal aggregated low).

Key blockers:

- Structure entity REST routes missing (M4 refactor removed old routes, generic never added)
- Account deletion endpoint absent
- Friend request accept/reject flow missing
- API key management entirely absent
- Custom field value routes for groups and structure entities missing
