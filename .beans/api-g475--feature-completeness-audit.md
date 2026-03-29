---
# api-g475
title: Feature completeness audit
status: todo
type: task
priority: high
created_at: 2026-03-29T02:58:32Z
updated_at: 2026-03-29T02:58:32Z
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

- [ ] Enumerate all features from M1-M7 scope documents
- [ ] Map each feature to its API endpoints
- [ ] Identify missing endpoints or incomplete CRUD sets
- [ ] Identify missing query filters or sort options the client will need
- [ ] Verify all list endpoints support the client's pagination needs
- [ ] Document gaps with severity (blocker vs. nice-to-have)
- [ ] Create follow-up beans for any missing functionality
