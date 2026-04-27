---
# types-gkhk
title: Brand FieldDefinition.name as FieldDefinitionLabel
status: todo
type: task
created_at: 2026-04-27T21:25:37Z
updated_at: 2026-04-27T21:25:37Z
parent: ps-cd6x
---

Per types-t3tn audit (2026-04-27): FieldDefinition.name is the field's display label (e.g. "Pronouns", "Age", "Job"). Sibling free-text "description" creates same-entity swap risk; further, the field is widely used as a UI label key with high confusion risk against content strings. Brand FieldDefinitionLabel = Brand<string, "FieldDefinitionLabel">. See docs/local-audits/2026-04-27-free-text-label-brand-audit.md.
