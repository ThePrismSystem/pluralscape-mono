---
# db-h1ns
title: Fix sessions.deviceInfo type mismatch
status: scrapped
type: bug
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T21:24:17Z
parent: db-gwpb
---

DB stores as string column but canonical type is a structured object. Add explicit mapper or change DB type. Ref: audit M21

## Reasons for Scrapping\n\nNot a bug. The column is `jsonb.$type<DeviceInfo | null>()`, which correctly types the column as `DeviceInfo | null`, not string.
