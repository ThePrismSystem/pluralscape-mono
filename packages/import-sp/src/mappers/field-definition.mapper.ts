/**
 * Field definition mapper.
 *
 * SP `customFields` collection → Pluralscape `field_definitions`. SP stores
 * field types as free-form strings, so a lookup table maps the known SP
 * variants to Pluralscape's {@link FieldType} union. Unknown SP types fall back
 * to `"text"` with a warning so the import never drops a field silently.
 */
import { mapped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPCustomField } from "../sources/sp-types.js";
import type { FieldType } from "@pluralscape/types";

export interface MappedFieldDefinition {
  readonly name: string;
  readonly fieldType: FieldType;
  readonly order: number;
  readonly supportMarkdown: boolean;
}

/**
 * Lookup from SP field type strings to Pluralscape {@link FieldType}. SP does
 * not expose an enum; the keys cover the types actually observed in SP exports
 * and the SP API. Pluralscape-only types (`boolean`, `select`, `multi-select`)
 * are not produced by SP, so they're absent here on purpose.
 */
const SP_TYPE_MAP: Readonly<Record<string, FieldType>> = {
  text: "text",
  number: "number",
  date: "date",
  color: "color",
  url: "url",
};

export function mapFieldDefinition(
  sp: SPCustomField,
  ctx: MappingContext,
): MapperResult<MappedFieldDefinition> {
  const fieldType = SP_TYPE_MAP[sp.type];
  if (fieldType === undefined) {
    ctx.addWarning({
      entityType: "field-definition",
      entityId: sp._id,
      message: `unknown SP field type "${sp.type}"; falling back to text`,
    });
  }
  const payload: MappedFieldDefinition = {
    name: sp.name,
    fieldType: fieldType ?? "text",
    order: sp.order,
    supportMarkdown: sp.supportMarkdown ?? false,
  };
  return mapped(payload);
}
