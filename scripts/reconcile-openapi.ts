import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { parse as parseYaml } from "yaml";

import { buildInventory } from "./audit-routes.js";

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

/**
 * Normalize all path parameter names to `{_}` for comparison.
 * This handles cases where spec uses `{transferId}` but code uses `{id}`.
 */
function normalizeParamNames(path: string): string {
  return path.replace(/\{[^}]+\}/g, "{_}");
}

function routeKeyString(method: string, path: string): string {
  return `${method.toUpperCase()} ${normalizeParamNames(normalizeParamStyle(path))}`;
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

/**
 * Extract structural shape from an inline OpenAPI schema.
 * Handles plain objects and allOf compositions (common in bundled specs).
 * Returns null if any part uses $ref.
 */
export function extractInlineShape(
  schema: Record<string, unknown>,
): Record<string, FieldShape> | null {
  if ("$ref" in schema) return null;

  // Handle allOf by merging all sub-schemas
  if (Array.isArray(schema.allOf)) {
    const merged: Record<string, FieldShape> = {};
    for (const sub of schema.allOf as Record<string, unknown>[]) {
      const subShape = extractInlineShape(sub);
      if (subShape === null) return null;
      Object.assign(merged, subShape);
    }
    return Object.keys(merged).length > 0 ? merged : null;
  }

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

export interface ShapeMismatch {
  field: string;
  issue: "missing_in_spec" | "extra_in_spec" | "type_mismatch" | "required_mismatch";
  codeType: string | null;
  specType: string | null;
}

/**
 * Compare two structural shapes field-by-field.
 * Reports missing fields, extra fields, type mismatches, and required/optional disagreements.
 */
export function compareShapes(
  codeShape: Record<string, FieldShape>,
  specShape: Record<string, FieldShape>,
): ShapeMismatch[] {
  const mismatches: ShapeMismatch[] = [];
  const allFields = new Set([...Object.keys(codeShape), ...Object.keys(specShape)]);

  for (const field of allFields) {
    const codeField = codeShape[field];
    const specField = specShape[field];

    if (codeField && !specField) {
      mismatches.push({
        field,
        issue: "missing_in_spec",
        codeType: codeField.type,
        specType: null,
      });
      continue;
    }

    if (!codeField && specField) {
      mismatches.push({ field, issue: "extra_in_spec", codeType: null, specType: specField.type });
      continue;
    }

    if (codeField && specField) {
      if (codeField.type !== specField.type) {
        mismatches.push({
          field,
          issue: "type_mismatch",
          codeType: codeField.type,
          specType: specField.type,
        });
      } else if (codeField.required !== specField.required) {
        mismatches.push({
          field,
          issue: "required_mismatch",
          codeType: codeField.type,
          specType: specField.type,
        });
      }
    }
  }

  return mismatches;
}

export interface RouteShapeMismatch {
  method: string;
  path: string;
  mismatches: ShapeMismatch[];
}

export interface ReconciliationReport {
  orphanedInSpec: RouteKey[];
  undocumented: RouteKey[];
  shapeMismatches: RouteShapeMismatch[];
  totalCodeRoutes: number;
  totalSpecOperations: number;
}

export function formatHumanOutput(report: ReconciliationReport): string {
  const lines: string[] = [];
  const total =
    report.orphanedInSpec.length + report.undocumented.length + report.shapeMismatches.length;

  lines.push(`Routes in code: ${String(report.totalCodeRoutes)}`);
  lines.push(`Operations in spec: ${String(report.totalSpecOperations)}`);
  lines.push("");

  if (total === 0) {
    lines.push("No discrepancies found.");
    return lines.join("\n");
  }

  if (report.orphanedInSpec.length > 0) {
    lines.push(`Orphaned spec entries (${String(report.orphanedInSpec.length)}):`);
    for (const r of report.orphanedInSpec) {
      lines.push(`  ${r.method} ${r.path}`);
    }
    lines.push("");
  }

  if (report.undocumented.length > 0) {
    lines.push(`Undocumented routes (${String(report.undocumented.length)}):`);
    for (const r of report.undocumented) {
      lines.push(`  ${r.method} ${r.path}`);
    }
    lines.push("");
  }

  if (report.shapeMismatches.length > 0) {
    lines.push(`Schema mismatches (${String(report.shapeMismatches.length)}):`);
    for (const sm of report.shapeMismatches) {
      lines.push(`  ${sm.method} ${sm.path}:`);
      for (const m of sm.mismatches) {
        lines.push(
          `    ${m.field}: ${m.issue} (code: ${m.codeType ?? "n/a"}, spec: ${m.specType ?? "n/a"})`,
        );
      }
    }
    lines.push("");
  }

  lines.push(`Total discrepancies: ${String(total)}`);
  return lines.join("\n");
}

export function formatJsonOutput(report: ReconciliationReport): string {
  return JSON.stringify(report, null, 2);
}

const argv1 = process.argv[1] ?? "";
if (import.meta.url === `file://${argv1}`) {
  const projectRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
  const specPath = resolve(projectRoot, "docs/openapi.yaml");
  const entryFile = resolve(projectRoot, "apps/api/src/routes/v1.ts");

  const specYaml = readFileSync(specPath, "utf-8");
  const spec = parseYaml(specYaml) as { paths: Record<string, unknown> };
  const specOps = parseSpecOperations(spec);

  const codeInventory = buildInventory(entryFile, "/v1", false);
  const codeRoutes = codeInventory.map((e) => ({ method: e.method, path: e.fullPath }));
  // Spec paths omit the /v1 prefix (it's in the server URL). Prepend it for comparison.
  const API_BASE_PATH = "/v1";
  const specRoutes = specOps.map((o) => ({ method: o.method, path: `${API_BASE_PATH}${o.path}` }));

  const diff = diffRoutes(codeRoutes, specRoutes);

  // Shape comparison placeholder — full Zod introspection deferred to M10
  const shapeMismatches: RouteShapeMismatch[] = [];

  const report: ReconciliationReport = {
    ...diff,
    shapeMismatches,
    totalCodeRoutes: codeRoutes.length,
    totalSpecOperations: specOps.length,
  };

  const isJson = process.argv.includes("--json");
  console.log(isJson ? formatJsonOutput(report) : formatHumanOutput(report));

  const hasDiscrepancies =
    diff.orphanedInSpec.length > 0 || diff.undocumented.length > 0 || shapeMismatches.length > 0;

  if (hasDiscrepancies) process.exit(1);
}
