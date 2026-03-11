---
# db-e5qm
title: Move sensitive plaintext metadata into encryptedData
status: completed
type: bug
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T22:31:43Z
parent: db-bbzk
---

innerworldEntities.positionX/Y leaks spatial structure. systemSettings.littlesSafeModeEnabled reveals system has littles. acknowledgements.targetMemberId + confirmed leaks communication patterns. innerworldEntities.entityType and innerworldRegions.accessType reveal access control topology. Ref: audit H9

## Summary of Changes

Removed plaintext columns: entityType/positionX/positionY from innerworld_entities, accessType from innerworld_regions, targetMemberId/confirmedAt from acknowledgements (kept confirmed as T3), littlesSafeModeEnabled from system_settings. Removed unused INNERWORLD_ENTITY_TYPES and INNERWORLD_REGION_ACCESS_TYPES enum arrays. Updated all schemas, types, views, and tests.
