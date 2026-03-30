---
# api-pnti
title: Verify CRDT sync document type coverage
status: completed
type: task
priority: high
created_at: 2026-03-29T21:31:42Z
updated_at: 2026-03-30T01:04:28Z
parent: api-e7gt
---

SyncDocumentType covers only 7 document types (system-core, fronting, chat, journal, note, privacy-config, bucket). Several entity families may be embedded in system-core but this should be verified against ADR-005: innerworld, timer configs, lifecycle events, relationships, friend connections, webhooks, analytics.

Audit ref: Domain 14, gap 1

## Summary of Changes

Research-only verification — no code changes needed.

### Findings

All 7 SyncDocumentType values cover all user-authored entities:

- **system-core**: 22 entity types (members, groups, structure, relationships, innerworld, timers, fields, lifecycle events, webhooks-config, fronting reports)
- **fronting**: fronting-session, fronting-comment, check-in-record
- **chat**: channels, messages, board-messages, polls, votes, acknowledgements
- **journal**: journal entries, wiki pages
- **note**: notes
- **privacy-config**: buckets, friend-connections, friend-codes, key-grants
- **bucket**: filtered projections for friend access

### Server-Authoritative (intentionally excluded from CRDT sync)

- analytics (computed aggregations)
- notification-config (server-managed)
- device-tokens (sensitive, server-managed)
- webhook-deliveries (transient delivery records)
- audit-log (immutable server audit trail)

All gaps identified in the audit are correctly server-authoritative.
