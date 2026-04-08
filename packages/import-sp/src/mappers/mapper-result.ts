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
 * - `failed` — the source document is malformed or references an unknown
 *   foreign key. The engine records a non-fatal error and continues.
 */
export type MapperResult<T> =
  | { readonly status: "mapped"; readonly payload: T }
  | { readonly status: "skipped"; readonly reason: string }
  | { readonly status: "failed"; readonly message: string };

export function mapped<T>(payload: T): MapperResult<T> {
  return { status: "mapped", payload };
}

export function skipped<T>(reason: string): MapperResult<T> {
  return { status: "skipped", reason };
}

export function failed<T>(message: string): MapperResult<T> {
  return { status: "failed", message };
}
