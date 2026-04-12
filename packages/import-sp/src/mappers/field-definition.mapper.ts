/**
 * Field definition mapper.
 *
 * SP `customFields` → Pluralscape `field_definitions`. SP's `type` is a
 * numeric enum 0-7 sourced from SP's `typeConverters` table; `order` is a
 * fractional-index string on migrated accounts (pre-migration exports may
 * still ship numeric orders, coerced to string form by the Zod validator).
 *
 * Ordering note: Pluralscape's `MappedFieldDefinition.sortOrder` is a number,
 * but SP's fractional-index strings cannot be losslessly converted per
 * document. We preserve lexicographic order using a best-effort base-36
 * prefix decode — sufficient for small field sets and lets users fine-tune
 * ordering after import.
 */
import {
  SP_FIELD_TYPE_COLOR,
  SP_FIELD_TYPE_DATE,
  SP_FIELD_TYPE_MONTH,
  SP_FIELD_TYPE_MONTH_DAY,
  SP_FIELD_TYPE_MONTH_YEAR,
  SP_FIELD_TYPE_TEXT,
  SP_FIELD_TYPE_TIMESTAMP,
  SP_FIELD_TYPE_YEAR,
} from "../import-sp.constants.js";

import { mapped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPCustomField, SPCustomFieldType } from "../sources/sp-types.js";
import type { FieldDefinitionEncryptedFields } from "@pluralscape/data";
import type { FieldType } from "@pluralscape/types";
import type { CreateFieldDefinitionBodySchema } from "@pluralscape/validation";
import type { z } from "zod/v4";

export type MappedFieldDefinition = Omit<
  z.infer<typeof CreateFieldDefinitionBodySchema>,
  "encryptedData"
> & {
  readonly encrypted: FieldDefinitionEncryptedFields;
};

/**
 * Map SP's numeric `CustomFieldType` enum to a Pluralscape {@link FieldType}.
 * Types 2-7 are all date-like representations in SP (full date, month, year,
 * monthYear, timestamp, monthDay) and collapse to `"date"` on our side.
 */
function spTypeToFieldType(spType: SPCustomFieldType): FieldType {
  switch (spType) {
    case SP_FIELD_TYPE_TEXT:
      return "text";
    case SP_FIELD_TYPE_COLOR:
      return "color";
    case SP_FIELD_TYPE_DATE:
    case SP_FIELD_TYPE_MONTH:
    case SP_FIELD_TYPE_YEAR:
    case SP_FIELD_TYPE_MONTH_YEAR:
    case SP_FIELD_TYPE_TIMESTAMP:
    case SP_FIELD_TYPE_MONTH_DAY:
      return "date";
    default: {
      const _exhaustive: never = spType;
      throw new Error(`unreachable SP custom-field type: ${String(_exhaustive)}`);
    }
  }
}

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
  const fieldType = spTypeToFieldType(sp.type);
  const orderResult = fractionalIndexToOrder(sp.order);
  if (!orderResult.ok) {
    ctx.addWarning({
      entityType: "field-definition",
      entityId: sp._id,
      message: `unparseable SP custom-field order "${sp.order}"; defaulting to 0 — reorder manually after import`,
    });
  }
  const encrypted: FieldDefinitionEncryptedFields = {
    name: sp.name,
    description: null,
    options: null,
  };
  const payload: MappedFieldDefinition = {
    encrypted,
    fieldType,
    required: false,
    sortOrder: orderResult.order,
  };
  return mapped(payload);
}
