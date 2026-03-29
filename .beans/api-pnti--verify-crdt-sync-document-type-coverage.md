---
# api-pnti
title: Verify CRDT sync document type coverage
status: todo
type: task
priority: high
created_at: 2026-03-29T21:31:42Z
updated_at: 2026-03-29T21:31:42Z
parent: api-e7gt
---

SyncDocumentType covers only 7 document types (system-core, fronting, chat, journal, note, privacy-config, bucket). Several entity families may be embedded in system-core but this should be verified against ADR-005: innerworld, timer configs, lifecycle events, relationships, friend connections, webhooks, analytics.

Audit ref: Domain 14, gap 1
