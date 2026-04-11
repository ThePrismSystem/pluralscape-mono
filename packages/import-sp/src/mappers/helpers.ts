import type { MappingContext } from "./context.js";
import type { ImportEntityType, ImportFailureKind } from "@pluralscape/types";

/**
 * Maximum number of unresolved foreign-key source IDs rendered inline in a
 * mapper error message by {@link summarizeMissingRefs}. Larger lists are
 * summarized with an "and N more" suffix; the full list still travels with
 * the error's structured `missingRefs` field.
 */
const MISSING_REFS_PREVIEW_LIMIT = 5;

/**
 * Emit one warning per (entityType, unknownKey) pair across the whole import.
 * The dedup key is scoped by entityType so two collections with the same
 * unknown field name each emit their own warning (pre-fix the key was
 * globally scoped, which silently merged unrelated schema drift).
 */
export function warnUnknownKeys(
  ctx: MappingContext,
  entityType: ImportEntityType,
  knownKeys: ReadonlySet<string>,
  payload: Record<string, unknown>,
): void {
  for (const key of Object.keys(payload)) {
    if (knownKeys.has(key)) continue;
    const warningKey = `unknown-field:${entityType}:${key}`;
    ctx.addWarningOnce(warningKey, {
      entityType,
      entityId: null,
      kind: "unknown-field",
      key: warningKey,
      message: `Unknown field "${key}" on ${entityType} (SP schema may have drifted)`,
    });
  }
}

/**
 * Render a bounded preview of unresolved-reference source IDs for inclusion
 * in a mapper error message. Keeps server logs short even when an entity has
 * hundreds of missing refs, while the full list remains on the error's
 * `missingRefs` structured field for downstream processing.
 */
export function summarizeMissingRefs(refs: readonly string[]): string {
  if (refs.length <= MISSING_REFS_PREVIEW_LIMIT) return refs.join(", ");
  const shown = refs.slice(0, MISSING_REFS_PREVIEW_LIMIT).join(", ");
  const remaining = refs.length - MISSING_REFS_PREVIEW_LIMIT;
  return `${shown}, and ${String(remaining)} more`;
}

/**
 * Empty-name guard shared by every mapper that requires a non-empty name.
 * Returns failure metadata when the name is missing; callers short-circuit
 * with `failed(...)`.
 */
export function requireName(
  name: string | null | undefined,
  entityType: ImportEntityType,
  sourceId: string,
): { kind: ImportFailureKind; message: string } | null {
  if (typeof name !== "string" || name.trim().length === 0) {
    return { kind: "empty-name", message: `${entityType} "${sourceId}" has empty name` };
  }
  return null;
}

/**
 * Standard dropped-field warning used by mappers that silently ignore SP
 * fields Pluralscape does not currently model.
 */
export function warnDropped(
  ctx: MappingContext,
  entityType: ImportEntityType,
  entityId: string | null,
  field: string,
  reason: string,
): void {
  ctx.addWarningOnce(`dropped-field:${entityType}:${field}`, {
    entityType,
    entityId,
    kind: "schema-mismatch",
    key: `dropped-field:${entityType}:${field}`,
    message: `Dropped ${entityType}.${field}: ${reason}`,
  });
}
