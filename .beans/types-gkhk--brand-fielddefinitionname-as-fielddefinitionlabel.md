---
# types-gkhk
title: Brand FieldDefinition.name as FieldDefinitionLabel
status: completed
type: task
priority: normal
created_at: 2026-04-27T21:25:37Z
updated_at: 2026-04-29T09:27:20Z
parent: ps-cd6x
---

FieldDefinition.name is the field's display label (e.g. "Pronouns", "Age", "Job"). Sibling free-text "description" creates same-entity swap risk; further, the field is widely used as a UI label key with high confusion risk against content strings. Brand FieldDefinitionLabel as a phantom brand.

## Summary of Changes

Defined FieldDefinitionLabel brand in packages/types/src/value-types.ts and applied it to FieldDefinition.name. Updated FieldDefinitionEncryptedInputSchema in packages/validation/src/custom-fields.ts to use brandedString<"FieldDefinitionLabel">(). Updated FieldDefinitionDecrypted.name in packages/data/src/transforms/custom-field.ts to use the brand. Canonical chain (FieldDefinitionEncryptedInput → ServerMetadata → Result → Wire) inherits the brand via existing Pick/Omit projections; Serialize<T> strips brands at the wire boundary.
