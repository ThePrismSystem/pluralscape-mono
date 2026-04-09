import type { MappingContext } from "./context.js";
import type { ImportEntityType, ImportFailureKind } from "@pluralscape/types";

/**
 * Emit one warning per (entityType, unknownKey) pair across the whole import.
 * Used after Zod `.passthrough()` validation to surface unknown SP fields
 * without blocking the import.
 */
export function warnUnknownKeys(
  ctx: MappingContext,
  entityType: ImportEntityType,
  knownKeys: ReadonlySet<string>,
  payload: Record<string, unknown>,
): void {
  for (const key of Object.keys(payload)) {
    if (knownKeys.has(key)) continue;
    const warningKey = `unknown-field:${key}`;
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
    kind: "validation-failed",
    key: `dropped-field:${entityType}:${field}`,
    message: `Dropped ${entityType}.${field}: ${reason}`,
  });
}
