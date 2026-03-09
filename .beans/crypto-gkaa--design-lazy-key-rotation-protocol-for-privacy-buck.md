---
# crypto-gkaa
title: Design lazy key rotation protocol for privacy buckets
status: todo
type: task
priority: critical
created_at: 2026-03-09T12:13:12Z
updated_at: 2026-03-09T12:13:12Z
parent: crypto-gd8f
---

Write an ADR for bucket key rotation that specifies: rotation state machine (pending/in-progress/completed), background worker protocol, client behavior when encountering stale-key ciphertext during rotation window, concurrent rotation serialization, maximum acceptable window between revocation and rotation completion. Currently O(bucket_size) with no lazy design.

Source: Architecture Audit 004, Fix This Now #2
