---
# db-qdla
title: Add encryptedKeyMaterial to deviceTransferRequests
status: todo
type: bug
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-11T19:39:48Z
parent: db-764i
---

ADR 011 Path 2 requires existing device to store encrypted MasterKey blob for new device. Table has no column for this ciphertext. Ref: audit M17
