---
# db-19ae
title: Validate switches.memberIds against system member IDs at app layer
status: scrapped
type: bug
priority: normal
created_at: 2026-03-12T01:39:44Z
updated_at: 2026-03-12T21:24:32Z
---

switches.memberIds is a JSONB array that cannot have FK constraints. Cross-system member IDs could be inserted with no server-side validation. Need application-layer validation to verify member IDs belong to the same system.

## Reasons for Scrapping\n\nReclassified as an API-layer concern, not a schema bug. Created api-gt2o to track the app-layer validation that switches.memberIds belong to the same system at write time.
