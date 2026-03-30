import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface RouteMethod {
  method: string;
  path: string;
}

export interface RouteFileInfo {
  hasAuth: boolean;
  rateLimitCategory: string | null;
  usesParseJsonBody: boolean;
  validationSchemas: string[];
  methods: RouteMethod[];
}

const METHOD_PATTERN = /\.(get|post|put|delete|patch)\(\s*["'](\/[^"']*?)["']/g;
const RATE_LIMIT_PATTERN = /createCategoryRateLimiter\(\s*["']([^"']+)["']\s*\)/;
const AUTH_MIDDLEWARE_PATTERN = /authMiddleware\(\)/;
const PARSE_JSON_BODY_PATTERN = /parseJsonBody\(/;
const VALIDATION_IMPORT_PATTERN = /import\s*\{([^}]+)\}\s*from\s*["']@pluralscape\/validation["']/;

export function parseRouteFile(source: string, _filename: string): RouteFileInfo {
  const methods: RouteMethod[] = [];
  let match: RegExpExecArray | null;
  const methodRegex = new RegExp(METHOD_PATTERN.source, METHOD_PATTERN.flags);
  while ((match = methodRegex.exec(source)) !== null) {
    const rawMethod = match[1];
    const rawPath = match[2];
    if (rawMethod !== undefined && rawPath !== undefined) {
      methods.push({ method: rawMethod.toUpperCase(), path: rawPath });
    }
  }

  const rateLimitMatch = RATE_LIMIT_PATTERN.exec(source);
  const rateLimitCategory = rateLimitMatch?.[1] ?? null;

  const hasAuth = AUTH_MIDDLEWARE_PATTERN.test(source);
  const usesParseJsonBody = PARSE_JSON_BODY_PATTERN.test(source);

  const validationSchemas: string[] = [];
  const validationMatch = VALIDATION_IMPORT_PATTERN.exec(source);
  if (validationMatch?.[1] !== undefined) {
    const imports = validationMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    validationSchemas.push(...imports.filter((s) => s.endsWith("Schema")));
  }

  return { hasAuth, rateLimitCategory, usesParseJsonBody, validationSchemas, methods };
}

export interface RouteMount {
  path: string;
  variableName: string;
}

const ROUTE_MOUNT_PATTERN = /\.route\(\s*["']([^"']+)["']\s*,\s*(\w+)\s*\)/g;

export function extractRouteMounts(source: string): RouteMount[] {
  const mounts: RouteMount[] = [];
  const regex = new RegExp(ROUTE_MOUNT_PATTERN.source, ROUTE_MOUNT_PATTERN.flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    const path = match[1];
    const variableName = match[2];
    if (path !== undefined && variableName !== undefined) {
      mounts.push({ path, variableName });
    }
  }
  return mounts;
}

export function resolveImportPath(
  source: string,
  variableName: string,
  currentFilePath: string,
): string | null {
  const pattern = new RegExp(
    `import\\s*\\{[^}]*\\b${variableName}\\b[^}]*\\}\\s*from\\s*["']([^"']+)["']`,
  );
  const match = pattern.exec(source);
  if (!match) return null;
  const importPath = match[1];
  if (!importPath?.startsWith(".")) return null;
  const dir = dirname(currentFilePath);
  const resolved = importPath.replace(/\.js$/, ".ts");
  return resolve(dir, resolved);
}

export interface RouteInventoryEntry {
  fullPath: string;
  method: string;
  hasAuth: boolean;
  rateLimitCategory: string | null;
  usesParseJsonBody: boolean;
  validationSchemas: string[];
  sourceFile: string;
}

function normalizePath(p: string): string {
  return p.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

export function buildInventory(
  entryFile: string,
  basePath: string,
  inheritedAuth: boolean,
): RouteInventoryEntry[] {
  const source = readFileSync(entryFile, "utf-8");
  const fileInfo = parseRouteFile(source, entryFile);
  const mounts = extractRouteMounts(source);
  const currentAuth = inheritedAuth || fileInfo.hasAuth;
  const entries: RouteInventoryEntry[] = [];

  for (const m of fileInfo.methods) {
    const fullPath = normalizePath(basePath + m.path);
    entries.push({
      fullPath,
      method: m.method,
      hasAuth: currentAuth,
      rateLimitCategory: fileInfo.rateLimitCategory,
      usesParseJsonBody: fileInfo.usesParseJsonBody,
      validationSchemas: fileInfo.validationSchemas,
      sourceFile: entryFile,
    });
  }

  for (const mount of mounts) {
    const childPath = resolveImportPath(source, mount.variableName, entryFile);
    if (!childPath) continue;
    const mountPath = normalizePath(basePath + mount.path);
    try {
      const childEntries = buildInventory(childPath, mountPath, currentAuth);
      entries.push(...childEntries);
    } catch {
      // File not found — skip
    }
  }

  return entries;
}

const argv1 = process.argv[1] ?? "";
if (import.meta.url === `file://${argv1}`) {
  const projectRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
  const entryFile = resolve(projectRoot, "apps/api/src/routes/v1.ts");
  const inventory = buildInventory(entryFile, "/v1", false);

  const flagged = inventory.filter(
    (e) =>
      !e.hasAuth ||
      e.rateLimitCategory === null ||
      (e.usesParseJsonBody && e.validationSchemas.length === 0),
  );

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(inventory, null, 2));
  } else if (process.argv.includes("--flagged")) {
    console.log(JSON.stringify(flagged, null, 2));
  } else {
    const missingAuth = inventory.filter((e) => !e.hasAuth).length;
    const noRateLimit = inventory.filter((e) => !e.rateLimitCategory).length;
    const noValidation = inventory.filter(
      (e) => e.usesParseJsonBody && e.validationSchemas.length === 0,
    ).length;
    console.log(`Total routes: ${String(inventory.length)}`);
    console.log(`Missing auth: ${String(missingAuth)}`);
    console.log(`No rate limit tier: ${String(noRateLimit)}`);
    console.log(`Uses parseJsonBody without validation: ${String(noValidation)}`);
    console.log(`\nFlagged routes:`);
    for (const e of flagged) {
      const flags: string[] = [];
      if (!e.hasAuth) flags.push("NO_AUTH");
      if (!e.rateLimitCategory) flags.push("NO_RATE_LIMIT");
      if (e.usesParseJsonBody && e.validationSchemas.length === 0) flags.push("NO_VALIDATION");
      console.log(`  ${e.method} ${e.fullPath} [${flags.join(", ")}]`);
    }
  }
}
