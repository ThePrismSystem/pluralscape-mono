/**
 * Field definition mapper.
 *
 * SP `customFields` → Pluralscape `field_definitions`. SP's `type` is a
 * numeric enum 0-7 sourced from SP's `typeConverters` table; `order` is a
 * fractional-index string on migrated accounts (pre-migration exports may
 * still ship numeric orders, coerced to string form by the Zod validator).
 *
 * Ordering note: Pluralscape's `MappedFieldDefinition.order` is a number,
 * but SP's fractional-index strings cannot be losslessly converted per
 * document. We preserve lexicographic order using a best-effort base-36
 * prefix decode — sufficient for small field sets and lets users fine-tune
 * ordering after import.
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
 * SP numeric `CustomFieldType` enum → Pluralscape {@link FieldType}.
 * Values sourced from SP's `typeConverters` array in
 * `src/api/base/user/generateReports.ts`. Types 2-7 are all date-like
 * representations in SP (full date, month, year, monthYear, timestamp,
 * monthDay) and collapse to `"date"` on our side.
 */
const SP_TYPE_NUMERIC_MAP: Readonly<Record<number, FieldType>> = {
  0: "text",
  1: "color",
  2: "date",
  3: "date",
  4: "date",
  5: "date",
  6: "date",
  7: "date",
};

/**
 * Number of leading characters of an SP fractional index to interpret as a
 * base-36 integer for ordering. Six matches SP's minimum index length per
 * the `^0|[a-z0-9]{6,}(:)?[a-z0-9]{0,}$` pattern.
 */
const FRACTIONAL_INDEX_PREFIX_LEN = 6;
const FRACTIONAL_INDEX_RADIX = 36;

/**
 * Convert an SP fractional-index string to a sortable integer. Uses the
 * first {@link FRACTIONAL_INDEX_PREFIX_LEN} characters, base-36 decoded.
 * Non-index strings (legacy numeric orders coerced to string) fall back to
 * `parseInt` in base 10. Returns 0 on anything unparseable — downstream
 * users can re-order manually.
 */
function fractionalIndexToOrder(index: string): number {
  if (index === "0") return 0;
  const prefix = index.slice(0, FRACTIONAL_INDEX_PREFIX_LEN);
  const base36 = parseInt(prefix, FRACTIONAL_INDEX_RADIX);
  if (Number.isFinite(base36)) return base36;
  const base10 = parseInt(index, 10);
  return Number.isFinite(base10) ? base10 : 0;
}

export function mapFieldDefinition(
  sp: SPCustomField,
  ctx: MappingContext,
): MapperResult<MappedFieldDefinition> {
  const fieldType = SP_TYPE_NUMERIC_MAP[sp.type];
  if (fieldType === undefined) {
    ctx.addWarning({
      entityType: "field-definition",
      entityId: sp._id,
      message: `unknown SP field type ${String(sp.type)}; falling back to text`,
    });
  }
  const payload: MappedFieldDefinition = {
    name: sp.name,
    fieldType: fieldType ?? "text",
    order: fractionalIndexToOrder(sp.order),
    supportMarkdown: sp.supportMarkdown ?? false,
  };
  return mapped(payload);
}
