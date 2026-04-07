/**
 * Validates that every authenticated REST route and tRPC procedure has a
 * corresponding entry in SCOPE_REGISTRY.
 *
 * Route parameter names may differ between the registry and actual route files
 * (e.g. `:id` vs `:systemId`), so comparison is done on normalized forms where
 * all `:paramName` segments are reduced to `:param`.
 *
 * Exit 0 = all covered; Exit 1 = missing or stale entries found.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildInventory } from "./audit-routes.js";
import { SCOPE_REGISTRY } from "../apps/api/src/lib/scope-registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

/** Replace all :paramName segments with :param for structural comparison. */
function normalizeParams(key: string): string {
  return key.replace(/:[^/\s]+/g, ":param");
}

// ---------------------------------------------------------------------------
// REST coverage
// ---------------------------------------------------------------------------

const entryFile = resolve(repoRoot, "apps/api/src/routes/v1.ts");
const allRoutes = buildInventory(entryFile, "/v1", false);

// Only authenticated routes under /v1/systems (and sub-paths)
// The notification stream is mounted at /v1/notifications/stream but is not
// discoverable via buildInventory (barrel re-export), so it is checked separately.
const authenticatedRoutes = allRoutes.filter(
  (e) => e.hasAuth && e.fullPath.startsWith("/v1/systems"),
);

// Session-only routes that intentionally have no scope registry entry.
// API keys are per-system, so creating/listing systems is session-only.
const EXCLUDED_REST_ROUTES = new Set(["GET /systems", "POST /systems"]);

// Strip /v1 prefix; registry keys have no prefix
const routeKeys = authenticatedRoutes
  .map((e) => `${e.method} ${e.fullPath.replace(/^\/v1/, "")}`)
  .filter((key) => !EXCLUDED_REST_ROUTES.has(key));

// Add the notification stream route manually — it's authenticated but not
// reachable via buildInventory due to barrel re-exports in its mount chain.
const HARDCODED_ROUTES = ["GET /notifications/stream"];
const allRouteKeys = [...routeKeys, ...HARDCODED_ROUTES];

// Build normalized sets for comparison
const routeNormSet = new Set(allRouteKeys.map(normalizeParams));
const registryNormSet = new Set([...SCOPE_REGISTRY.rest.keys()].map(normalizeParams));

const missingRest: string[] = [];
for (const key of allRouteKeys) {
  if (!registryNormSet.has(normalizeParams(key))) {
    missingRest.push(key);
  }
}

const staleRest: string[] = [];
for (const key of SCOPE_REGISTRY.rest.keys()) {
  if (!routeNormSet.has(normalizeParams(key))) {
    staleRest.push(key);
  }
}

// ---------------------------------------------------------------------------
// tRPC coverage — parse root.ts + each router file
// ---------------------------------------------------------------------------

/**
 * Map from router variable name to the file stem it's imported from.
 * root.ts imports from `./routers/<stem>.js`.
 */
function parseRootRouterMap(rootSource: string): Map<string, string> {
  const importPattern = /import\s*\{([^}]+)\}\s*from\s*["']\.\/routers\/([^"']+)["']/g;
  const routerToFile = new Map<string, string>();
  let m: RegExpExecArray | null;
  while ((m = importPattern.exec(rootSource)) !== null) {
    const names = m[1]!
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const fileStem = m[2]!.replace(/\.js$/, "");
    for (const name of names) {
      routerToFile.set(name, fileStem);
    }
  }
  return routerToFile;
}

/**
 * Parse the appRouter object literal to map router key → variable name.
 * e.g. `member: memberRouter` → { "member" => "memberRouter" }
 */
function parseAppRouterKeys(rootSource: string): Map<string, string> {
  const routerBlockMatch = /export const appRouter\s*=\s*router\(\{([\s\S]*?)\}\)/.exec(rootSource);
  if (!routerBlockMatch) return new Map();
  const block = routerBlockMatch[1]!;
  const entryPattern = /^\s*(\w+)\s*:\s*(\w+)\s*,?\s*$/gm;
  const result = new Map<string, string>();
  let m: RegExpExecArray | null;
  while ((m = entryPattern.exec(block)) !== null) {
    result.set(m[1]!, m[2]!);
  }
  return result;
}

/**
 * Extract procedure keys from the outermost `router({...})` export in source,
 * building dotted keys under `prefix`. Handles one level of nested sub-routers.
 */
function extractProcedureKeys(source: string, prefix: string): string[] {
  const keys: string[] = [];

  const exportRouterMatch = /export const \w+Router\s*=\s*router\(\{/.exec(source);
  if (!exportRouterMatch) return keys;

  const startIdx = exportRouterMatch.index + exportRouterMatch[0].length;
  let depth = 1;
  let i = startIdx;
  let content = "";
  while (i < source.length && depth > 0) {
    const ch = source[i]!;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) break;
    }
    content += ch;
    i++;
  }

  extractKeysFromBlock(content, prefix, keys);
  return keys;
}

/**
 * Recursively extract dotted procedure keys from a router block string.
 */
function extractKeysFromBlock(block: string, prefix: string, keys: string[]): void {
  let i = 0;
  while (i < block.length) {
    // Skip whitespace and commas
    if (/[\s,]/.test(block[i]!)) {
      i++;
      continue;
    }

    // Match a key identifier followed by colon
    const keyMatch = /^(\w+)\s*:/.exec(block.slice(i));
    if (!keyMatch) {
      i++;
      continue;
    }

    const key = keyMatch[1]!;
    const fullKey = prefix ? `${prefix}.${key}` : key;
    i += keyMatch[0].length;

    // Skip whitespace after colon
    while (i < block.length && /\s/.test(block[i]!)) i++;

    // Check if the value is a nested `router({...})`
    const nestedRouterMatch = /^router\s*\(\{/.exec(block.slice(i));
    if (nestedRouterMatch) {
      i += nestedRouterMatch[0].length;
      let depth = 1;
      let nestedContent = "";
      while (i < block.length && depth > 0) {
        const ch = block[i]!;
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
        nestedContent += ch;
        i++;
      }
      // Skip closing `)` of router()
      while (i < block.length) {
        if (block[i] === ")") {
          i++;
          break;
        }
        if (block[i] === ",") {
          i++;
          break;
        }
        i++;
      }
      extractKeysFromBlock(nestedContent, fullKey, keys);
    } else {
      // Leaf procedure — record the key and skip to next top-level entry
      keys.push(fullKey);
      let depth = 0;
      while (i < block.length) {
        const ch = block[i]!;
        if (ch === "(" || ch === "{" || ch === "[") depth++;
        else if (ch === ")" || ch === "}" || ch === "]") {
          if (depth === 0) break;
          depth--;
        } else if (ch === "," && depth === 0) {
          i++;
          break;
        }
        i++;
      }
    }
  }
}

// Excluded routers (session-only, no scope enforcement)
const EXCLUDED_ROUTERS = new Set(["auth", "account", "friend", "friendCode"]);
// Excluded procedures (intentionally unscoped)
const EXCLUDED_PROCEDURES = new Set(["system.create", "system.list"]);

const rootSource = readFileSync(resolve(repoRoot, "apps/api/src/trpc/root.ts"), "utf-8");

const routerToFile = parseRootRouterMap(rootSource);
const appRouterKeys = parseAppRouterKeys(rootSource);

const allTrpcKeys: string[] = [];

for (const [routerKey, varName] of appRouterKeys) {
  if (EXCLUDED_ROUTERS.has(routerKey)) continue;

  const fileStem = routerToFile.get(varName);
  if (!fileStem) {
    console.warn(`  [warn] Could not resolve file for router "${routerKey}" (var: ${varName})`);
    continue;
  }

  const filePath = resolve(repoRoot, "apps/api/src/trpc/routers", `${fileStem}.ts`);
  let source: string;
  try {
    source = readFileSync(filePath, "utf-8");
  } catch {
    console.warn(`  [warn] Could not read router file: ${filePath}`);
    continue;
  }

  const procedureKeys = extractProcedureKeys(source, routerKey);
  allTrpcKeys.push(...procedureKeys);
}

const coveredTrpcKeys = allTrpcKeys.filter((k) => !EXCLUDED_PROCEDURES.has(k));

const missingTrpc: string[] = [];
for (const key of coveredTrpcKeys) {
  if (!SCOPE_REGISTRY.trpc.has(key)) {
    missingTrpc.push(key);
  }
}

const staleTrpc: string[] = [];
const trpcKeySet = new Set([...allTrpcKeys, ...EXCLUDED_PROCEDURES]);
for (const key of SCOPE_REGISTRY.trpc.keys()) {
  if (!trpcKeySet.has(key)) {
    staleTrpc.push(key);
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

let hasIssues = false;

if (missingRest.length > 0) {
  hasIssues = true;
  console.error(`\nMissing REST scope registry entries (${String(missingRest.length)}):`);
  for (const key of missingRest) {
    console.error(`  - ${key}`);
  }
}

if (staleRest.length > 0) {
  hasIssues = true;
  console.error(`\nStale REST scope registry entries (${String(staleRest.length)}):`);
  for (const key of staleRest) {
    console.error(`  - ${key}`);
  }
}

if (missingTrpc.length > 0) {
  hasIssues = true;
  console.error(`\nMissing tRPC scope registry entries (${String(missingTrpc.length)}):`);
  for (const key of missingTrpc) {
    console.error(`  - ${key}`);
  }
}

if (staleTrpc.length > 0) {
  hasIssues = true;
  console.error(`\nStale tRPC scope registry entries (${String(staleTrpc.length)}):`);
  for (const key of staleTrpc) {
    console.error(`  - ${key}`);
  }
}

if (hasIssues) {
  console.error("\nScope coverage check FAILED.");
  process.exit(1);
} else {
  const restCount = allRouteKeys.length;
  const trpcCount = coveredTrpcKeys.length;
  console.log(
    `Scope coverage OK: ${String(restCount)} REST routes, ${String(trpcCount)} tRPC procedures all covered.`,
  );
  process.exit(0);
}
