---
# api-6fv1
title: System settings
status: todo
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-17T03:06:18Z
parent: ps-rdqo
---

Nomenclature preferences, notification config, timezone

### Deletion pattern

- System settings are singleton per system — no deletion endpoint (settings are updated, not deleted)
- Custom field definitions: DELETE returns 409 HAS_DEPENDENTS if field has values or bucket visibility mappings
