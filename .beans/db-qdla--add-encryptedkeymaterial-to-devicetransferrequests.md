---
# db-qdla
title: Add encryptedKeyMaterial to deviceTransferRequests
status: completed
type: bug
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T03:06:53Z
parent: db-764i
---

ADR 011 Path 2 requires existing device to store encrypted MasterKey blob for new device. Table has no column for this ciphertext. Ref: audit M17

## Summary of Changes\n\nAdded nullable `encryptedKeyMaterial` binary column to deviceTransferRequests table (PG and SQLite). Updated test helper DDL and added integration tests for null default and binary round-trip.
