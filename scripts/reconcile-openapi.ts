export interface RouteKey {
  method: string;
  path: string;
}

/**
 * Normalize Express-style `:param` to OpenAPI-style `{param}`.
 * Already-normalized `{param}` paths are returned unchanged.
 */
export function normalizeParamStyle(path: string): string {
  return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, "{$1}");
}

function routeKeyString(method: string, path: string): string {
  return `${method.toUpperCase()} ${normalizeParamStyle(path)}`;
}

export interface DiffResult {
  orphanedInSpec: RouteKey[];
  undocumented: RouteKey[];
}

/**
 * Bidirectional set diff of route keys.
 * Paths are normalized before comparison so `:id` matches `{id}`.
 */
export function diffRoutes(codeRoutes: RouteKey[], specRoutes: RouteKey[]): DiffResult {
  const codeSet = new Set(codeRoutes.map((r) => routeKeyString(r.method, r.path)));
  const specSet = new Set(specRoutes.map((r) => routeKeyString(r.method, r.path)));

  const orphanedInSpec = specRoutes
    .filter((r) => !codeSet.has(routeKeyString(r.method, r.path)))
    .map((r) => ({ method: r.method.toUpperCase(), path: normalizeParamStyle(r.path) }));

  const undocumented = codeRoutes
    .filter((r) => !specSet.has(routeKeyString(r.method, r.path)))
    .map((r) => ({ method: r.method.toUpperCase(), path: normalizeParamStyle(r.path) }));

  return { orphanedInSpec, undocumented };
}
