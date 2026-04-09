/**
 * MapperResult — discriminated union returned by every mapper.
 *
 * Mappers decide their own fate (ok, skip, or fail) and return a tagged result
 * the engine handles uniformly. The engine never inspects the `mapped` payload
 * shape; it just hands it to the `Persister` for the corresponding entity type.
 *
 * - `mapped` — the source document was translated into a Pluralscape-shaped
 *   payload ready for persistence.
 * - `skipped` — the source document is valid but intentionally not imported
 *   (e.g., user deselected the category, empty required field, duplicate).
 *   Carries an {@link ImportFailureKind} so the engine can categorise skips.
 * - `failed` — the source document is malformed or references an unknown
 *   foreign key. Carries a structured {@link ImportFailureKind}, the human
 *   message, any unresolved source refs, and the field that triggered the
 *   failure. The engine records a non-fatal error and continues.
 */
import type { ImportFailureKind } from "@pluralscape/types";

export type MapperResult<T> =
  | { readonly status: "mapped"; readonly payload: T }
  | {
      readonly status: "skipped";
      readonly kind: ImportFailureKind;
      readonly reason: string;
    }
  | {
      readonly status: "failed";
      readonly kind: ImportFailureKind;
      readonly message: string;
      readonly missingRefs?: readonly string[];
      readonly targetField?: string;
    };

export function mapped<T>(payload: T): MapperResult<T> {
  return { status: "mapped", payload };
}

export function skipped<T>(args: { kind: ImportFailureKind; reason: string }): MapperResult<T> {
  return { status: "skipped", kind: args.kind, reason: args.reason };
}

export function failed<T>(args: {
  kind: ImportFailureKind;
  message: string;
  missingRefs?: readonly string[];
  targetField?: string;
}): MapperResult<T> {
  return {
    status: "failed",
    kind: args.kind,
    message: args.message,
    missingRefs: args.missingRefs,
    targetField: args.targetField,
  };
}
