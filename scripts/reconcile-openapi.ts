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

const HTTP_METHODS = new Set(["get", "post", "put", "delete", "patch"]);

export interface FieldShape {
  type: string;
  required: boolean;
}

export interface SpecOperation {
  method: string;
  path: string;
  operationId: string;
  requestBodyShape: Record<string, FieldShape> | null;
}

function extractInlineShape(schema: Record<string, unknown>): Record<string, FieldShape> | null {
  if ("$ref" in schema) return null;
  if (
    schema.type !== "object" ||
    typeof schema.properties !== "object" ||
    schema.properties === null
  ) {
    return null;
  }

  const requiredSet = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);
  const properties = schema.properties as Record<string, Record<string, unknown>>;
  const shape: Record<string, FieldShape> = {};

  for (const [name, prop] of Object.entries(properties)) {
    const type = typeof prop.type === "string" ? prop.type : "unknown";
    shape[name] = { type, required: requiredSet.has(name) };
  }

  return shape;
}

export function parseSpecOperations(spec: { paths: Record<string, unknown> }): SpecOperation[] {
  const operations: SpecOperation[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    if (typeof pathItem !== "object" || pathItem === null) continue;

    for (const [method, operation] of Object.entries(pathItem as Record<string, unknown>)) {
      if (!HTTP_METHODS.has(method)) continue;
      if (typeof operation !== "object" || operation === null) continue;

      const op = operation as Record<string, unknown>;
      const operationId = typeof op.operationId === "string" ? op.operationId : "";

      let requestBodyShape: Record<string, FieldShape> | null = null;
      if (typeof op.requestBody === "object" && op.requestBody !== null) {
        const rb = op.requestBody as Record<string, unknown>;
        const content = rb.content as Record<string, unknown> | undefined;
        const jsonContent = content?.["application/json"] as Record<string, unknown> | undefined;
        const schema = jsonContent?.schema as Record<string, unknown> | undefined;
        if (schema !== undefined) {
          requestBodyShape = extractInlineShape(schema);
        }
      }

      operations.push({ method: method.toUpperCase(), path, operationId, requestBodyShape });
    }
  }

  return operations;
}
