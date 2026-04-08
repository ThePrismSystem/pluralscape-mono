/**
 * Field value extractor.
 *
 * SP encodes per-member custom-field values inside the member document as a
 * `Record<customFieldId, stringValue>` under the `info` key. The import engine
 * needs these as standalone rows keyed by (member, field), so this helper
 * flattens the map into an array the member mapper includes in its output.
 *
 * Empty values are dropped with a warning — SP sometimes emits `""` for
 * unfilled fields, and persisting an empty string would clutter the user's
 * Pluralscape data with meaningless rows.
 */
import type { MappingContext } from "./context.js";

export interface ExtractedFieldValue {
  readonly memberSourceId: string;
  readonly fieldSourceId: string;
  readonly value: string;
}

export function extractFieldValues(
  input: {
    readonly memberSourceId: string;
    readonly info: Readonly<Record<string, string>> | undefined;
  },
  ctx: MappingContext,
): readonly ExtractedFieldValue[] {
  if (!input.info) return [];
  const out: ExtractedFieldValue[] = [];
  for (const [fieldSourceId, value] of Object.entries(input.info)) {
    if (typeof value !== "string" || value.length === 0) {
      ctx.addWarning({
        entityType: "field-value",
        entityId: `${input.memberSourceId}/${fieldSourceId}`,
        message: "empty field value; skipping",
      });
      continue;
    }
    out.push({ memberSourceId: input.memberSourceId, fieldSourceId, value });
  }
  return out;
}
