---
# api-gt2o
title: Validate switches.memberIds belong to same system at write time
status: todo
type: task
created_at: 2026-03-12T21:24:26Z
updated_at: 2026-03-12T21:24:26Z
---

App-layer validation: when writing a switch record, verify all memberIds in the array belong to the same system as the switch. This is a business-logic constraint, not a schema concern. Reclassified from db-19ae.
