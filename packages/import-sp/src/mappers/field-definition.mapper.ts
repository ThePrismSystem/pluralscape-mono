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
 * Convert an SP fractional-index string to a sortable integer.
 *
 * Two input shapes:
 *  - Pre-migration numeric orders (e.g. `"42"`) coerced to string by the
 *    Zod validator — decoded in base 10 via the `/^\d+$/` regex check.
 *  - Modern fractional indices (e.g. `"a00000"`) — first
 *    {@link FRACTIONAL_INDEX_PREFIX_LEN} characters decoded in base 36.
 *
 * Returns `{ ok: false, order: 0 }` on unparseable input so the caller can
 * emit a warning — users can re-order manually post-import.
 */
function fractionalIndexToOrder(index: string): { readonly order: number; readonly ok: boolean } {
  if (/^\d+$/.test(index)) {
    const base10 = parseInt(index, 10);
    return Number.isFinite(base10) ? { order: base10, ok: true } : { order: 0, ok: false };
  }
  const prefix = index.slice(0, FRACTIONAL_INDEX_PREFIX_LEN);
  const base36 = parseInt(prefix, FRACTIONAL_INDEX_RADIX);
  if (Number.isFinite(base36)) return { order: base36, ok: true };
  return { order: 0, ok: false };
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
  const orderResult = fractionalIndexToOrder(sp.order);
  if (!orderResult.ok) {
    ctx.addWarning({
      entityType: "field-definition",
      entityId: sp._id,
      message: `unparseable SP custom-field order "${sp.order}"; defaulting to 0 — reorder manually after import`,
    });
  }
  const payload: MappedFieldDefinition = {
    name: sp.name,
    fieldType: fieldType ?? "text",
    order: orderResult.order,
    supportMarkdown: sp.supportMarkdown ?? false,
  };
  return mapped(payload);
}
