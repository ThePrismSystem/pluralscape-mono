import { UnresolvedRefError } from "./client.js";

/**
 * Walk a POST body object and replace any `FixtureRef`-shaped string values
 * with the corresponding server-side ObjectId from `refMap`.
 *
 * A "ref-shaped" string is any string matching the convention
 * `<entityType>.<name>` (lowercase letters, digits, and hyphens, exactly one dot).
 * Non-matching strings pass through untouched. Nested objects recurse; arrays of
 * strings check each element.
 *
 * Throws `UnresolvedRefError` if a ref-shaped string is encountered that is not
 * in the map — this catches fixture ordering bugs before any network call.
 */
export function resolveRefs<T>(body: T, refMap: ReadonlyMap<string, string>): T {
  return resolveValue(body, refMap) as T;
}

function resolveValue(value: unknown, refMap: ReadonlyMap<string, string>): unknown {
  if (typeof value === "string") {
    return resolveMaybeRef(value, refMap);
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, refMap));
  }
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolveValue(v, refMap);
    }
    return out;
  }
  return value;
}

function resolveMaybeRef(s: string, refMap: ReadonlyMap<string, string>): string {
  // Ref convention: "<entityType>.<name>" — lowercase letters, digits, hyphens with EXACTLY ONE dot.
  // Real SP field values (member names, descriptions, etc.) will not match because they
  // typically contain spaces, capitals, multiple dots, or special characters.
  if (!/^[a-z][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/.test(s)) return s;
  const resolved = refMap.get(s);
  if (resolved === undefined) throw new UnresolvedRefError(s);
  return resolved;
}
