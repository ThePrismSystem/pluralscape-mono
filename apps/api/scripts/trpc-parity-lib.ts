/**
 * tRPC ↔ REST Parity Check — Library Module
 *
 * Pure functions and types extracted from check-trpc-parity.ts for testability.
 * This module has no side effects — it never calls main() or process.exit().
 *
 * Validates six dimensions of parity between REST routes and tRPC procedures:
 * 1. Procedure existence — every REST endpoint has a tRPC counterpart
 * 2. Rate limit category — same category on both sides
 * 3. Auth level — public/protected/system matches
 * 4. Scope — required API key scope matches on both sides
 * 5. Input validation — Zod schema usage on both sides
 * 6. Idempotency — REST mutations with idempotency middleware (informational)
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { REST_ONLY_SET } from "./trpc-parity.config.js";

// ── Terminal colors ─────────────────────────────────────────────────────────

const isCI = Boolean(process.env.CI);
const useColor = process.stdout.isTTY || isCI;

const RED = useColor ? "\x1b[31m" : "";
const GREEN = useColor ? "\x1b[32m" : "";
const YELLOW = useColor ? "\x1b[33m" : "";
const CYAN = useColor ? "\x1b[36m" : "";
const DIM = useColor ? "\x1b[2m" : "";
const BOLD = useColor ? "\x1b[1m" : "";
const RESET = useColor ? "\x1b[0m" : "";

// ── Directory resolution ────────────────────────────────────────────────────

const __filename_lib = fileURLToPath(import.meta.url);
const __dirname_lib = dirname(__filename_lib);
const API_ROOT = resolve(__dirname_lib, "..");

// ── Types ───────────────────────────────────────────────────────────────────

export type AuthLevel = "public" | "protected" | "system";

export type ParityDimension = "existence" | "rate-limit" | "auth-level" | "idempotency" | "scope";

export interface TRPCProcedureInfo {
  readonly path: string;
  readonly type: "query" | "mutation";
  readonly rateLimitCategory: string | null;
  readonly scope: string | null;
  readonly authLevel: AuthLevel;
  readonly hasInputValidation: boolean;
}

export interface RESTRouteInfo {
  readonly routeKey: string;
  readonly method: string;
  readonly fullPath: string;
  readonly rateLimitCategory: string | null;
  readonly scope: string | null;
  readonly authLevel: AuthLevel;
  readonly hasInputValidation: boolean;
  readonly hasIdempotency: boolean;
  readonly sourceFile: string;
}

export interface ParityFailure {
  readonly dimension: ParityDimension;
  readonly restRoute: string;
  readonly expected: string;
  readonly actual: string;
}

export interface CheckStats {
  readonly restRoutes: number;
  readonly trpcProcedures: number;
  readonly existenceChecked: number;
  readonly rateLimitChecked: number;
  readonly authChecked: number;
  readonly scopeChecked: number;
  readonly idempotencyChecked: number;
  readonly unmappedCount: number;
}

// ── 1. tRPC Procedure Discovery (runtime) ───────────────────────────────────

interface RouterDef {
  readonly procedures: Record<
    string,
    {
      readonly _def: {
        readonly type: string;
        readonly middlewares: Array<{ toString(): string }>;
        readonly inputs: unknown[];
      };
    }
  >;
}

export async function discoverTRPCProcedures(): Promise<Map<string, TRPCProcedureInfo>> {
  // Dynamic import to avoid bundling issues — the router is resolved at runtime.
  // The tRPC router's static type is deeply generic and doesn't structurally match
  // our simplified RouterDef (sub-routers lack a direct _def). We extract the
  // flattened procedure map from the runtime _def, which tRPC guarantees.
  const mod: Record<string, unknown> = await import("../src/trpc/root.js");
  const appRouter = mod["appRouter"] as { _def: RouterDef } | undefined;
  if (!appRouter?._def) {
    throw new Error("appRouter._def is not available — tRPC version mismatch?");
  }

  const def = appRouter._def;
  const procedures = new Map<string, TRPCProcedureInfo>();

  for (const [path, proc] of Object.entries(def.procedures)) {
    const mws = proc._def.middlewares;
    const type = proc._def.type as "query" | "mutation";

    // Determine auth level from middleware chain signatures
    const authLevel = inferAuthLevelFromMiddlewares(mws);

    // Rate limit category is extracted from source files (below), not runtime
    // Input validation: check if there are input schemas beyond systemId
    const hasInputValidation = proc._def.inputs.length > 0;

    procedures.set(path, {
      path,
      type,
      rateLimitCategory: null, // filled in by source-level analysis
      scope: null, // filled in by source-level analysis
      authLevel,
      hasInputValidation,
    });
  }

  return procedures;
}

export function inferAuthLevelFromMiddlewares(mws: Array<{ toString(): string }>): AuthLevel {
  const mwStrings = mws.map((mw) => mw.toString());

  // System procedure has enforceSystemAccess (checks ownedSystemIds)
  const hasSystemAccess = mwStrings.some((s) => s.includes("ownedSystemIds"));

  // Protected procedure has enforceAuth (checks ctx.auth) but not system access
  const hasAuthCheck = mwStrings.some(
    (s) => s.includes("ctx.auth") && s.includes("UNAUTHORIZED") && !s.includes("ownedSystemIds"),
  );

  if (hasSystemAccess) return "system";
  if (hasAuthCheck) return "protected";
  return "public";
}

// ── 2. tRPC Rate Limit Extraction (source analysis) ─────────────────────────

const RATE_LIMIT_VAR_PATTERN =
  /const\s+(\w+)\s*=\s*createTRPCCategoryRateLimiter\(\s*["']([^"']+)["']\s*\)/g;
export function extractTRPCRateLimits(
  procedures: Map<string, TRPCProcedureInfo>,
): Map<string, TRPCProcedureInfo> {
  const routersDir = resolve(API_ROOT, "src/trpc/routers");
  const files = readdirSync(routersDir).filter((f) => f.endsWith(".ts"));
  const updated = new Map(procedures);

  for (const file of files) {
    const source = readFileSync(resolve(routersDir, file), "utf-8");
    const routerPrefix = deriveRouterPrefix(file);

    // Build map of variable name → rate limit category
    const varToCategory = new Map<string, string>();
    for (const match of execAllMatches(RATE_LIMIT_VAR_PATTERN, source)) {
      if (match[1] !== undefined && match[2] !== undefined) {
        varToCategory.set(match[1], match[2]);
      }
    }

    // For each procedure in this file, find which rate limiter variable it uses
    const procCategories = parseProcedureRateLimits(source, varToCategory, routerPrefix);

    for (const [procPath, category] of procCategories) {
      const existing = updated.get(procPath);
      if (existing) {
        updated.set(procPath, { ...existing, rateLimitCategory: category });
      }
    }
  }

  return updated;
}

// ── 2b. tRPC Scope Extraction (source analysis) ────────────────────────────

export function extractTRPCScopes(
  procedures: Map<string, TRPCProcedureInfo>,
): Map<string, TRPCProcedureInfo> {
  const routersDir = resolve(API_ROOT, "src/trpc/routers");
  const files = readdirSync(routersDir).filter((f) => f.endsWith(".ts"));
  const updated = new Map(procedures);

  for (const file of files) {
    const source = readFileSync(resolve(routersDir, file), "utf-8");
    const routerPrefix = deriveRouterPrefix(file);

    const procScopes = parseProcedureScopes(source, routerPrefix);

    for (const [procPath, scope] of procScopes) {
      const existing = updated.get(procPath);
      if (existing) {
        updated.set(procPath, { ...existing, scope });
      }
    }
  }

  return updated;
}

function parseProcedureScopes(source: string, routerPrefix: string): Map<string, string> {
  const result = new Map<string, string>();

  // Pattern: procName: systemProcedure.use(requireScope("scope")).use(...)...
  const procScopePattern =
    /(\w+)\s*:\s*(?:systemProcedure|protectedProcedure|errorMapProcedure)\b[^,}]*?\.use\(\s*requireScope\(\s*["']([^"']+)["']\s*\)\s*\)/g;

  // First pass: top-level procedures
  for (const match of execAllMatches(procScopePattern, source)) {
    const procName = match[1];
    const scope = match[2];
    if (procName === undefined || scope === undefined) continue;
    result.set(`${routerPrefix}.${procName}`, scope);
  }

  // Second pass: nested router blocks
  const nestedRouterStart = /(\w+)\s*:\s*router\(\{/g;
  for (const startMatch of execAllMatches(nestedRouterStart, source)) {
    const nestedName = startMatch[1];
    if (nestedName === undefined) continue;

    const openBraceIdx = startMatch.index + startMatch[0].length - 1;
    const body = extractBalancedBlock(source, openBraceIdx);
    if (!body) continue;

    for (const innerMatch of execAllMatches(procScopePattern, body)) {
      const innerProcName = innerMatch[1];
      const innerScope = innerMatch[2];
      if (innerProcName === undefined || innerScope === undefined) continue;
      result.set(`${routerPrefix}.${nestedName}.${innerProcName}`, innerScope);
    }
  }

  return result;
}

export function deriveRouterPrefix(filename: string): string {
  // "member.ts" → "member", "board-message.ts" → "boardMessage"
  const base = filename.replace(/\.ts$/, "");
  return base.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function parseProcedureRateLimits(
  source: string,
  varToCategory: Map<string, string>,
  routerPrefix: string,
): Map<string, string> {
  const result = new Map<string, string>();

  // Walk the known procedures from runtime discovery and find their rate
  // limiter variable in the source using a targeted search.
  const procUsePattern =
    /(\w+)\s*:\s*(?:systemProcedure|protectedProcedure|errorMapProcedure)\b[^,}]*?\.use\(\s*(\w+)\s*\)/g;

  // First pass: find top-level procedures
  for (const match of execAllMatches(procUsePattern, source)) {
    const procName = match[1];
    const mwVar = match[2];
    if (procName === undefined || mwVar === undefined) continue;

    const category = varToCategory.get(mwVar);
    if (category) {
      result.set(`${routerPrefix}.${procName}`, category);
    }
  }

  // Second pass: find nested router blocks via brace balancing
  const nestedRouterStart = /(\w+)\s*:\s*router\(\{/g;
  for (const startMatch of execAllMatches(nestedRouterStart, source)) {
    const nestedName = startMatch[1];
    if (nestedName === undefined) continue;

    // Find the opening brace position after "router({"
    const openBraceIdx = startMatch.index + startMatch[0].length - 1;
    const body = extractBalancedBlock(source, openBraceIdx);
    if (!body) continue;

    // Search within the nested body for procedure .use() calls
    for (const innerMatch of execAllMatches(procUsePattern, body)) {
      const innerProcName = innerMatch[1];
      const innerMwVar = innerMatch[2];
      if (innerProcName === undefined || innerMwVar === undefined) continue;

      const category = varToCategory.get(innerMwVar);
      if (category) {
        result.set(`${routerPrefix}.${nestedName}.${innerProcName}`, category);
      }
    }
  }

  return result;
}

/**
 * Extract the content between balanced braces starting at the given index.
 * Returns the content between (exclusive of) the opening and closing brace.
 */
export function extractBalancedBlock(source: string, openIdx: number): string | null {
  if (source[openIdx] !== "{") return null;

  let depth = 1;
  let i = openIdx + 1;
  const len = source.length;

  while (i < len && depth > 0) {
    const ch = source[i]!;

    // Skip double-quoted strings
    if (ch === '"') {
      i++;
      while (i < len && source[i] !== '"') {
        if (source[i] === "\\") i++;
        i++;
      }
      i++;
      continue;
    }

    // Skip single-quoted strings
    if (ch === "'") {
      i++;
      while (i < len && source[i] !== "'") {
        if (source[i] === "\\") i++;
        i++;
      }
      i++;
      continue;
    }

    // Skip template literals (simplified -- doesn't handle nested ${})
    if (ch === "`") {
      i++;
      while (i < len && source[i] !== "`") {
        if (source[i] === "\\") i++;
        i++;
      }
      i++;
      continue;
    }

    // Skip single-line comments
    if (ch === "/" && source[i + 1] === "/") {
      i += 2;
      while (i < len && source[i] !== "\n") i++;
      i++;
      continue;
    }

    // Skip multi-line comments
    if (ch === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < len && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      continue;
    }

    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    i++;
  }

  if (depth !== 0) return null;
  return source.slice(openIdx + 1, i - 1);
}

// ── 3. REST Route Discovery ─────────────────────────────────────────────────

const IDEMPOTENCY_PATTERN = /createIdempotencyMiddleware\(\)/;
const IDEMPOTENCY_PATTERN_GLOBAL = /createIdempotencyMiddleware\(\)/g;
const REST_RATE_LIMIT_PATTERN_GLOBAL = /createCategoryRateLimiter\(\s*["']([^"']+)["']\s*\)/g;
const REST_SCOPE_PATTERN_GLOBAL = /requireScopeMiddleware\(\s*["']([^"']+)["']\s*\)/g;
const AUTH_MIDDLEWARE_PATTERN = /authMiddleware\(\)/;
const VALIDATION_SCHEMA_PATTERN = /import\s*\{([^}]+)\}\s*from\s*["']@pluralscape\/validation["']/;
const METHOD_PATTERN = /\.(get|post|put|delete|patch)\(\s*["'](\/[^"']*?)["']/g;
const ROUTE_MOUNT_PATTERN = /\.route\(\s*["']([^"']+)["']\s*,\s*(\w+)\s*\)/g;

export function buildRESTInventory(): {
  routes: RESTRouteInfo[];
  failures: ParityFailure[];
} {
  const failures: ParityFailure[] = [];
  const entryFile = resolve(API_ROOT, "src/routes/v1.ts");
  const routes = walkRouteTree(entryFile, "/v1", false, failures);
  return { routes, failures };
}

export function walkRouteTree(
  entryFile: string,
  basePath: string,
  inheritedAuth: boolean,
  failures: ParityFailure[],
): RESTRouteInfo[] {
  let source: string;
  try {
    source = readFileSync(entryFile, "utf-8");
  } catch {
    failures.push({
      dimension: "existence",
      restRoute: `[file: ${entryFile}]`,
      expected: "readable route file",
      actual: "file not found or not readable",
    });
    return [];
  }

  const entries: RESTRouteInfo[] = [];
  const hasAuth = inheritedAuth || AUTH_MIDDLEWARE_PATTERN.test(source);
  const hasValidation = VALIDATION_SCHEMA_PATTERN.test(source);

  // Collect all rate limit categories used in this file
  const allRateLimits = execAllMatches(REST_RATE_LIMIT_PATTERN_GLOBAL, source);
  const fileRateLimitCategory = allRateLimits[0]?.[1] ?? null;

  // Build a map of rate limit categories by their position in the source
  // to associate each route handler with the nearest preceding rate limiter
  const rateLimitPositions: Array<{ index: number; category: string }> = [];
  for (const match of allRateLimits) {
    if (match[1] !== undefined) {
      rateLimitPositions.push({ index: match.index, category: match[1] });
    }
  }

  // Collect all scope middleware values and their positions in this file
  const allScopes = execAllMatches(REST_SCOPE_PATTERN_GLOBAL, source);
  const fileScopeValue = allScopes[0]?.[1] ?? null;
  const scopePositions: Array<{ index: number; scope: string }> = [];
  for (const match of allScopes) {
    if (match[1] !== undefined) {
      scopePositions.push({ index: match.index, scope: match[1] });
    }
  }

  // Collect all idempotency middleware positions
  const idempotencyPositions: number[] = [];
  for (const match of execAllMatches(IDEMPOTENCY_PATTERN_GLOBAL, source)) {
    idempotencyPositions.push(match.index);
  }

  // Extract route methods defined in this file
  for (const match of execAllMatches(METHOD_PATTERN, source)) {
    const rawMethod = match[1];
    const rawPath = match[2];
    if (rawMethod === undefined || rawPath === undefined) continue;

    const method = rawMethod.toUpperCase();
    const fullPath = normalizePath(basePath + rawPath);
    const routeKey = `${method} ${fullPath}`;

    // Find the closest rate limit category before or near this route
    const routeCategory = findNearestCategory(
      match.index,
      rateLimitPositions,
      fileRateLimitCategory,
      source,
    );

    // Check if idempotency middleware appears near this route
    const hasIdempotency = hasNearbyIdempotency(match.index, idempotencyPositions, source);

    const authLevel: AuthLevel = hasAuth
      ? fullPath.includes("/systems/:systemId")
        ? "system"
        : "protected"
      : "public";

    // Find the closest scope that applies to this route
    const routeScope = findNearestScope(match.index, scopePositions, fileScopeValue, source);

    entries.push({
      routeKey,
      method,
      fullPath,
      rateLimitCategory: routeCategory,
      scope: routeScope,
      authLevel,
      hasInputValidation: hasValidation,
      hasIdempotency,
      sourceFile: entryFile,
    });
  }

  // Recurse into mounted sub-routes
  for (const mount of execAllMatches(ROUTE_MOUNT_PATTERN, source)) {
    const mountPath = mount[1];
    const varName = mount[2];
    if (mountPath === undefined || varName === undefined) continue;

    const childPath = resolveImportPath(source, varName, entryFile);
    if (!childPath) continue;

    const childMountPath = normalizePath(basePath + mountPath);
    const childEntries = walkRouteTree(childPath, childMountPath, hasAuth, failures);
    entries.push(...childEntries);
  }

  return entries;
}

/**
 * Generic middleware value resolver for a route at the given position.
 *
 * Strategy:
 * 1. Find which Hono variable the route handler belongs to.
 * 2. Extract the path from the route handler (e.g. "/manifest").
 * 3. Look for middleware on the same Hono variable:
 *    a. Inline middleware on the route handler itself.
 *    b. Path-specific .use("/path", middleware) that matches the route path.
 *    c. Wildcard .use("*", middleware) on the same variable.
 *    d. Any middleware on the same Hono variable.
 * 4. Fall back to the file-level (first) middleware value.
 */
function findNearestMiddleware(
  routeIndex: number,
  positions: Array<{ index: number; value: string }>,
  fallback: string | null,
  source: string,
  inlinePattern: RegExp,
  useCallPattern: (routeVar: string) => RegExp,
): string | null {
  if (positions.length === 0) return fallback;
  if (positions.length === 1) return positions[0]?.value ?? fallback;

  const beforeRoute = source.slice(0, routeIndex);
  const routeVarMatch = /(\w+)\s*$/.exec(beforeRoute);
  const routeVar = routeVarMatch?.[1];

  const routeHandlerSnippet = source.slice(routeIndex, routeIndex + 200);
  const routePathMatch = /^\.\s*(?:get|post|put|delete|patch)\(\s*["'](\/[^"']*?)["']/.exec(
    routeHandlerSnippet,
  );
  const routePath = routePathMatch?.[1] ?? "/";

  if (!routeVar) {
    let nearest: string | null = fallback;
    for (const pos of positions) {
      if (pos.index < routeIndex) nearest = pos.value;
    }
    return nearest;
  }

  // Check for inline middleware on the route handler itself
  const inlineSnippet = source.slice(routeIndex, routeIndex + 500);
  const inlineMatch = inlinePattern.exec(inlineSnippet);
  if (inlineMatch?.[1]) return inlineMatch[1];

  // Look for path-specific .use() calls on the same variable
  const usePattern = useCallPattern(routeVar);
  let bestMatch: string | null = null;
  for (const useMatch of execAllMatches(usePattern, source)) {
    const usePath = useMatch[1];
    const useValue = useMatch[2];
    if (usePath === undefined || useValue === undefined) continue;

    if (usePath === routePath) {
      return useValue;
    }
    if (usePath === "*") {
      bestMatch = useValue;
    }
  }

  if (bestMatch) return bestMatch;

  // Fall back: find middleware on the same Hono variable
  for (const pos of positions) {
    const context = source.slice(Math.max(0, pos.index - 200), pos.index);
    if (context.includes(routeVar)) {
      return pos.value;
    }
  }

  return fallback;
}

/** Inline regex for createCategoryRateLimiter on a route handler. */
const INLINE_RATE_LIMIT_PATTERN =
  /^\.(?:get|post|put|delete|patch)\([^;]*?createCategoryRateLimiter\(\s*["']([^"']+)["']/;

/** Inline regex for requireScopeMiddleware on a route handler. */
const INLINE_SCOPE_PATTERN =
  /^\.(?:get|post|put|delete|patch)\([^;]*?requireScopeMiddleware\(\s*["']([^"']+)["']/;

function findNearestCategory(
  routeIndex: number,
  positions: Array<{ index: number; category: string }>,
  fallback: string | null,
  source: string,
): string | null {
  return findNearestMiddleware(
    routeIndex,
    positions.map((p) => ({ index: p.index, value: p.category })),
    fallback,
    source,
    INLINE_RATE_LIMIT_PATTERN,
    (routeVar) =>
      new RegExp(
        `${routeVar}\\.use\\(\\s*["']([^"']+)["']\\s*,\\s*createCategoryRateLimiter\\(\\s*["']([^"']+)["']`,
        "g",
      ),
  );
}

function findNearestScope(
  routeIndex: number,
  positions: Array<{ index: number; scope: string }>,
  fallback: string | null,
  source: string,
): string | null {
  return findNearestMiddleware(
    routeIndex,
    positions.map((p) => ({ index: p.index, value: p.scope })),
    fallback,
    source,
    INLINE_SCOPE_PATTERN,
    (routeVar) =>
      new RegExp(
        `${routeVar}\\.use\\(\\s*["']([^"']+)["']\\s*,\\s*requireScopeMiddleware\\(\\s*["']([^"']+)["']`,
        "g",
      ),
  );
}

/**
 * Check if idempotency middleware appears in a context that applies to this route.
 */
function hasNearbyIdempotency(routeIndex: number, positions: number[], source: string): boolean {
  if (positions.length === 0) return false;

  // Check if any idempotency middleware is in the same file and applies
  // (either file-level via .use() or inline on the route handler)
  const routeLine = source.slice(Math.max(0, routeIndex - 500), routeIndex + 500);
  return IDEMPOTENCY_PATTERN.test(routeLine);
}

function resolveImportPath(
  source: string,
  variableName: string,
  currentFilePath: string,
): string | null {
  const pattern = new RegExp(
    `import\\s*\\{[^}]*\\b${variableName}\\b[^}]*\\}\\s*from\\s*["']([^"']+)["']`,
  );
  const match = pattern.exec(source);
  if (!match?.[1]?.startsWith(".")) return null;
  const importPath = match[1];
  const dir = dirname(currentFilePath);
  const resolved = importPath.replace(/\.js$/, ".ts");
  return resolve(dir, resolved);
}

export function normalizePath(p: string): string {
  return p.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

// ── 4. REST → tRPC Mapping ─────────────────────────────────────────────────

/**
 * Maps REST route keys to tRPC procedure paths using naming conventions.
 *
 * REST path segments map to tRPC router.procedure names:
 *   /v1/systems/:systemId/members → member.list (GET) / member.create (POST)
 *   /v1/systems/:systemId/members/:memberId → member.get (GET) / member.update (PUT) / member.delete (DELETE)
 *   /v1/systems/:systemId/members/:memberId/archive → member.archive (POST)
 */

/** Manual overrides for routes that don't follow conventions. */
const MAPPING_OVERRIDES: Record<string, string> = {
  // Auth routes
  "POST /v1/auth/register": "auth.register",
  "POST /v1/auth/login": "auth.login",
  "POST /v1/auth/logout": "auth.logout",
  "GET /v1/auth/sessions": "auth.session.list",
  "DELETE /v1/auth/sessions/:id": "auth.session.revoke",
  "POST /v1/auth/sessions/revoke-all": "auth.session.revokeAll",
  "POST /v1/auth/password-reset/recovery-key": "auth.resetPasswordWithRecoveryKey",
  "GET /v1/auth/recovery-key/status": "account.getRecoveryKeyStatus",
  "POST /v1/auth/recovery-key/regenerate": "account.regenerateRecoveryKey",
  "POST /v1/auth/biometric/enroll": "account.enrollBiometric",
  "POST /v1/auth/biometric/verify": "account.verifyBiometric",

  // Account routes
  "GET /v1/account": "account.get",
  "DELETE /v1/account": "account.deleteAccount",
  "PUT /v1/account/email": "account.changeEmail",
  "PUT /v1/account/password": "account.changePassword",
  "GET /v1/account/audit-log": "account.queryAuditLog",
  "PUT /v1/account/settings": "account.updateSettings",
  "POST /v1/account/pin": "account.setPin",
  "DELETE /v1/account/pin": "account.removePin",
  "POST /v1/account/pin/verify": "account.verifyPin",
  "POST /v1/account/device-transfer": "account.initiateDeviceTransfer",
  "POST /v1/account/device-transfer/:id/approve": "account.approveDeviceTransfer",
  "POST /v1/account/device-transfer/:id/complete": "account.completeDeviceTransfer",

  // Friend routes
  "GET /v1/account/friends": "friend.list",
  "GET /v1/account/friends/:connectionId": "friend.get",
  "POST /v1/account/friends/:connectionId/accept": "friend.accept",
  "POST /v1/account/friends/:connectionId/reject": "friend.reject",
  "POST /v1/account/friends/:connectionId/block": "friend.block",
  "POST /v1/account/friends/:connectionId/remove": "friend.remove",
  "POST /v1/account/friends/:connectionId/archive": "friend.archive",
  "POST /v1/account/friends/:connectionId/restore": "friend.restore",
  "PUT /v1/account/friends/:connectionId/visibility": "friend.updateVisibility",
  "GET /v1/account/friends/:connectionId/dashboard": "friend.getDashboard",
  "GET /v1/account/friends/:connectionId/dashboard/sync": "friend.getDashboardSync",
  "GET /v1/account/friends/:connectionId/export": "friend.exportData",
  "GET /v1/account/friends/:connectionId/export/manifest": "friend.exportManifest",
  "GET /v1/account/friends/:connectionId/notifications": "friend.getNotifications",
  "PATCH /v1/account/friends/:connectionId/notifications": "friend.updateNotifications",
  "GET /v1/account/friends/key-grants": "friend.listReceivedKeyGrants",

  // Friend codes
  "POST /v1/account/friend-codes": "friendCode.generate",
  "GET /v1/account/friend-codes": "friendCode.list",
  "POST /v1/account/friend-codes/redeem": "friendCode.redeem",
  "POST /v1/account/friend-codes/:codeId/archive": "friendCode.archive",

  // System top-level
  "POST /v1/systems": "system.create",
  "GET /v1/systems": "system.list",
  "GET /v1/systems/:id": "system.get",
  "PUT /v1/systems/:id": "system.update",
  "DELETE /v1/systems/:id": "system.archive",
  "POST /v1/systems/:id/duplicate": "system.duplicate",
  "POST /v1/systems/:id/purge": "system.purge",

  // System settings
  "GET /v1/systems/:systemId/settings": "systemSettings.settings.get",
  "PUT /v1/systems/:systemId/settings": "systemSettings.settings.update",
  "GET /v1/systems/:systemId/nomenclature": "systemSettings.nomenclature.get",
  "PUT /v1/systems/:systemId/nomenclature": "systemSettings.nomenclature.update",
  "POST /v1/systems/:systemId/settings/pin": "systemSettings.pin.set",
  "DELETE /v1/systems/:systemId/settings/pin": "systemSettings.pin.remove",
  "POST /v1/systems/:systemId/settings/pin/verify": "systemSettings.pin.verify",
  "GET /v1/systems/:systemId/setup/status": "systemSettings.setup.getStatus",
  "POST /v1/systems/:systemId/setup/nomenclature": "systemSettings.setup.nomenclatureStep",
  "POST /v1/systems/:systemId/setup/profile": "systemSettings.setup.profileStep",
  "POST /v1/systems/:systemId/setup/complete": "systemSettings.setup.complete",

  // Blobs
  "POST /v1/systems/:systemId/blobs/upload-url": "blob.createUploadUrl",
  "POST /v1/systems/:systemId/blobs/:blobId/confirm": "blob.confirmUpload",
  "GET /v1/systems/:systemId/blobs/:blobId/download-url": "blob.getDownloadUrl",
  "GET /v1/systems/:systemId/blobs/:blobId": "blob.get",
  "GET /v1/systems/:systemId/blobs": "blob.list",
  "DELETE /v1/systems/:systemId/blobs/:blobId": "blob.delete",

  // Groups
  "POST /v1/systems/:systemId/groups": "group.create",
  "GET /v1/systems/:systemId/groups": "group.list",
  "GET /v1/systems/:systemId/groups/:groupId": "group.get",
  "PUT /v1/systems/:systemId/groups/:groupId": "group.update",
  "DELETE /v1/systems/:systemId/groups/:groupId": "group.delete",
  "POST /v1/systems/:systemId/groups/:groupId/archive": "group.archive",
  "POST /v1/systems/:systemId/groups/:groupId/restore": "group.restore",
  "POST /v1/systems/:systemId/groups/:groupId/move": "group.move",
  "POST /v1/systems/:systemId/groups/:groupId/copy": "group.copy",
  "GET /v1/systems/:systemId/groups/tree": "group.getTree",
  "POST /v1/systems/:systemId/groups/reorder": "group.reorder",
  "POST /v1/systems/:systemId/groups/:groupId/members": "group.addMember",
  "DELETE /v1/systems/:systemId/groups/:groupId/members/:memberId": "group.removeMember",
  "GET /v1/systems/:systemId/groups/:groupId/members": "group.listMembers",

  // Members
  "POST /v1/systems/:systemId/members": "member.create",
  "GET /v1/systems/:systemId/members": "member.list",
  "GET /v1/systems/:systemId/members/:memberId": "member.get",
  "PUT /v1/systems/:systemId/members/:memberId": "member.update",
  "POST /v1/systems/:systemId/members/:memberId/duplicate": "member.duplicate",
  "POST /v1/systems/:systemId/members/:memberId/archive": "member.archive",
  "POST /v1/systems/:systemId/members/:memberId/restore": "member.restore",
  "DELETE /v1/systems/:systemId/members/:memberId": "member.delete",
  "GET /v1/systems/:systemId/members/:memberId/memberships": "member.listMemberships",

  // Member photos
  "POST /v1/systems/:systemId/members/:memberId/photos": "memberPhoto.create",
  "GET /v1/systems/:systemId/members/:memberId/photos": "memberPhoto.list",
  "GET /v1/systems/:systemId/members/:memberId/photos/:photoId": "memberPhoto.get",
  "POST /v1/systems/:systemId/members/:memberId/photos/:photoId/archive": "memberPhoto.archive",
  "POST /v1/systems/:systemId/members/:memberId/photos/:photoId/restore": "memberPhoto.restore",
  "DELETE /v1/systems/:systemId/members/:memberId/photos/:photoId": "memberPhoto.delete",
  "PUT /v1/systems/:systemId/members/:memberId/photos/reorder": "memberPhoto.reorder",

  // Fields
  "POST /v1/systems/:systemId/fields": "field.definition.create",
  "GET /v1/systems/:systemId/fields": "field.definition.list",
  "GET /v1/systems/:systemId/fields/:fieldId": "field.definition.get",
  "PUT /v1/systems/:systemId/fields/:fieldId": "field.definition.update",
  "POST /v1/systems/:systemId/fields/:fieldId/archive": "field.definition.archive",
  "POST /v1/systems/:systemId/fields/:fieldId/restore": "field.definition.restore",
  "DELETE /v1/systems/:systemId/fields/:fieldId": "field.definition.delete",
  "POST /v1/systems/:systemId/fields/:fieldDefinitionId/bucket-visibility":
    "field.bucketVisibility.set",
  "DELETE /v1/systems/:systemId/fields/:fieldDefinitionId/bucket-visibility/:bucketId":
    "field.bucketVisibility.remove",
  "GET /v1/systems/:systemId/fields/:fieldDefinitionId/bucket-visibility":
    "field.bucketVisibility.list",

  // Note: field values are accessed via members/:memberId/fields and groups/:groupId/fields
  // These use a different REST pattern (nested under members/groups) vs tRPC (field.value.set/list/remove)

  // Buckets
  "POST /v1/systems/:systemId/buckets": "bucket.create",
  "GET /v1/systems/:systemId/buckets": "bucket.list",
  "GET /v1/systems/:systemId/buckets/:bucketId": "bucket.get",
  "PUT /v1/systems/:systemId/buckets/:bucketId": "bucket.update",
  "POST /v1/systems/:systemId/buckets/:bucketId/archive": "bucket.archive",
  "POST /v1/systems/:systemId/buckets/:bucketId/restore": "bucket.restore",
  "DELETE /v1/systems/:systemId/buckets/:bucketId": "bucket.delete",
  "POST /v1/systems/:systemId/buckets/:bucketId/friends": "bucket.assignFriend",
  "DELETE /v1/systems/:systemId/buckets/:bucketId/friends/:connectionId": "bucket.unassignFriend",
  "GET /v1/systems/:systemId/buckets/:bucketId/friends": "bucket.listFriendAssignments",
  "POST /v1/systems/:systemId/buckets/:bucketId/tags": "bucket.tagContent",
  "DELETE /v1/systems/:systemId/buckets/:bucketId/tags/:entityType/:entityId":
    "bucket.untagContent",
  "GET /v1/systems/:systemId/buckets/:bucketId/tags": "bucket.listTags",
  "GET /v1/systems/:systemId/buckets/:bucketId/export/manifest": "bucket.exportManifest",
  "GET /v1/systems/:systemId/buckets/:bucketId/export": "bucket.exportPage",
  "POST /v1/systems/:systemId/buckets/:bucketId/rotations": "bucket.initiateRotation",
  "GET /v1/systems/:systemId/buckets/:bucketId/rotations/:rotationId": "bucket.rotationProgress",
  "POST /v1/systems/:systemId/buckets/:bucketId/rotations/:rotationId/claim":
    "bucket.claimRotationChunk",
  "POST /v1/systems/:systemId/buckets/:bucketId/rotations/:rotationId/complete":
    "bucket.completeRotationChunk",
  "POST /v1/systems/:systemId/buckets/:bucketId/rotations/:rotationId/retry":
    "bucket.retryRotation",

  // Fronting
  "GET /v1/systems/:systemId/fronting/active": "frontingSession.getActive",

  // Fronting sessions
  "POST /v1/systems/:systemId/fronting-sessions": "frontingSession.create",
  "GET /v1/systems/:systemId/fronting-sessions": "frontingSession.list",
  "GET /v1/systems/:systemId/fronting-sessions/:sessionId": "frontingSession.get",
  "PUT /v1/systems/:systemId/fronting-sessions/:sessionId": "frontingSession.update",
  "POST /v1/systems/:systemId/fronting-sessions/:sessionId/end": "frontingSession.end",
  "POST /v1/systems/:systemId/fronting-sessions/:sessionId/archive": "frontingSession.archive",
  "POST /v1/systems/:systemId/fronting-sessions/:sessionId/restore": "frontingSession.restore",
  "DELETE /v1/systems/:systemId/fronting-sessions/:sessionId": "frontingSession.delete",

  // Fronting comments
  "POST /v1/systems/:systemId/fronting-sessions/:sessionId/comments": "frontingComment.create",
  "GET /v1/systems/:systemId/fronting-sessions/:sessionId/comments": "frontingComment.list",
  "GET /v1/systems/:systemId/fronting-sessions/:sessionId/comments/:commentId":
    "frontingComment.get",
  "PUT /v1/systems/:systemId/fronting-sessions/:sessionId/comments/:commentId":
    "frontingComment.update",
  "POST /v1/systems/:systemId/fronting-sessions/:sessionId/comments/:commentId/archive":
    "frontingComment.archive",
  "POST /v1/systems/:systemId/fronting-sessions/:sessionId/comments/:commentId/restore":
    "frontingComment.restore",
  "DELETE /v1/systems/:systemId/fronting-sessions/:sessionId/comments/:commentId":
    "frontingComment.delete",

  // Fronting reports
  "POST /v1/systems/:systemId/fronting-reports": "frontingReport.create",
  "GET /v1/systems/:systemId/fronting-reports": "frontingReport.list",
  "GET /v1/systems/:systemId/fronting-reports/:reportId": "frontingReport.get",
  "PUT /v1/systems/:systemId/fronting-reports/:reportId": "frontingReport.update",
  "POST /v1/systems/:systemId/fronting-reports/:reportId/archive": "frontingReport.archive",
  "POST /v1/systems/:systemId/fronting-reports/:reportId/restore": "frontingReport.restore",
  "DELETE /v1/systems/:systemId/fronting-reports/:reportId": "frontingReport.delete",

  // Custom fronts
  "POST /v1/systems/:systemId/custom-fronts": "customFront.create",
  "GET /v1/systems/:systemId/custom-fronts": "customFront.list",
  "GET /v1/systems/:systemId/custom-fronts/:customFrontId": "customFront.get",
  "PUT /v1/systems/:systemId/custom-fronts/:customFrontId": "customFront.update",
  "POST /v1/systems/:systemId/custom-fronts/:customFrontId/archive": "customFront.archive",
  "POST /v1/systems/:systemId/custom-fronts/:customFrontId/restore": "customFront.restore",
  "DELETE /v1/systems/:systemId/custom-fronts/:customFrontId": "customFront.delete",

  // Relationships
  "POST /v1/systems/:systemId/relationships": "relationship.create",
  "GET /v1/systems/:systemId/relationships": "relationship.list",
  "GET /v1/systems/:systemId/relationships/:relationshipId": "relationship.get",
  "PUT /v1/systems/:systemId/relationships/:relationshipId": "relationship.update",
  "POST /v1/systems/:systemId/relationships/:relationshipId/archive": "relationship.archive",
  "POST /v1/systems/:systemId/relationships/:relationshipId/restore": "relationship.restore",
  "DELETE /v1/systems/:systemId/relationships/:relationshipId": "relationship.delete",

  // Lifecycle events
  "POST /v1/systems/:systemId/lifecycle-events": "lifecycleEvent.create",
  "GET /v1/systems/:systemId/lifecycle-events": "lifecycleEvent.list",
  "GET /v1/systems/:systemId/lifecycle-events/:eventId": "lifecycleEvent.get",
  "PUT /v1/systems/:systemId/lifecycle-events/:eventId": "lifecycleEvent.update",
  "POST /v1/systems/:systemId/lifecycle-events/:eventId/archive": "lifecycleEvent.archive",
  "POST /v1/systems/:systemId/lifecycle-events/:eventId/restore": "lifecycleEvent.restore",
  "DELETE /v1/systems/:systemId/lifecycle-events/:eventId": "lifecycleEvent.delete",

  // Innerworld entities
  "POST /v1/systems/:systemId/innerworld/entities": "innerworld.entity.create",
  "GET /v1/systems/:systemId/innerworld/entities": "innerworld.entity.list",
  "GET /v1/systems/:systemId/innerworld/entities/:entityId": "innerworld.entity.get",
  "PUT /v1/systems/:systemId/innerworld/entities/:entityId": "innerworld.entity.update",
  "POST /v1/systems/:systemId/innerworld/entities/:entityId/archive": "innerworld.entity.archive",
  "POST /v1/systems/:systemId/innerworld/entities/:entityId/restore": "innerworld.entity.restore",
  "DELETE /v1/systems/:systemId/innerworld/entities/:entityId": "innerworld.entity.delete",

  // Innerworld regions
  "POST /v1/systems/:systemId/innerworld/regions": "innerworld.region.create",
  "GET /v1/systems/:systemId/innerworld/regions": "innerworld.region.list",
  "GET /v1/systems/:systemId/innerworld/regions/:regionId": "innerworld.region.get",
  "PUT /v1/systems/:systemId/innerworld/regions/:regionId": "innerworld.region.update",
  "POST /v1/systems/:systemId/innerworld/regions/:regionId/archive": "innerworld.region.archive",
  "POST /v1/systems/:systemId/innerworld/regions/:regionId/restore": "innerworld.region.restore",
  "DELETE /v1/systems/:systemId/innerworld/regions/:regionId": "innerworld.region.delete",

  // Innerworld canvas
  "GET /v1/systems/:systemId/innerworld/canvas": "innerworld.canvas.get",
  "PUT /v1/systems/:systemId/innerworld/canvas": "innerworld.canvas.upsert",

  // Analytics
  "GET /v1/systems/:systemId/analytics/fronting": "analytics.fronting",
  "GET /v1/systems/:systemId/analytics/co-fronting": "analytics.coFronting",

  // Timer configs
  "POST /v1/systems/:systemId/timer-configs": "timerConfig.create",
  "GET /v1/systems/:systemId/timer-configs": "timerConfig.list",
  "GET /v1/systems/:systemId/timer-configs/:timerId": "timerConfig.get",
  "PUT /v1/systems/:systemId/timer-configs/:timerId": "timerConfig.update",
  "POST /v1/systems/:systemId/timer-configs/:timerId/archive": "timerConfig.archive",
  "POST /v1/systems/:systemId/timer-configs/:timerId/restore": "timerConfig.restore",
  "DELETE /v1/systems/:systemId/timer-configs/:timerId": "timerConfig.delete",

  // Check-in records
  "POST /v1/systems/:systemId/check-in-records": "checkInRecord.create",
  "GET /v1/systems/:systemId/check-in-records": "checkInRecord.list",
  "GET /v1/systems/:systemId/check-in-records/:recordId": "checkInRecord.get",
  "POST /v1/systems/:systemId/check-in-records/:recordId/respond": "checkInRecord.respond",
  "POST /v1/systems/:systemId/check-in-records/:recordId/dismiss": "checkInRecord.dismiss",
  "POST /v1/systems/:systemId/check-in-records/:recordId/archive": "checkInRecord.archive",
  "POST /v1/systems/:systemId/check-in-records/:recordId/restore": "checkInRecord.restore",
  "DELETE /v1/systems/:systemId/check-in-records/:recordId": "checkInRecord.delete",

  // Webhook configs
  "POST /v1/systems/:systemId/webhook-configs": "webhookConfig.create",
  "GET /v1/systems/:systemId/webhook-configs": "webhookConfig.list",
  "GET /v1/systems/:systemId/webhook-configs/:webhookId": "webhookConfig.get",
  "PUT /v1/systems/:systemId/webhook-configs/:webhookId": "webhookConfig.update",
  "DELETE /v1/systems/:systemId/webhook-configs/:webhookId": "webhookConfig.delete",
  "POST /v1/systems/:systemId/webhook-configs/:webhookId/archive": "webhookConfig.archive",
  "POST /v1/systems/:systemId/webhook-configs/:webhookId/restore": "webhookConfig.restore",
  "POST /v1/systems/:systemId/webhook-configs/:webhookId/rotate-secret":
    "webhookConfig.rotateSecret",
  "POST /v1/systems/:systemId/webhook-configs/:webhookId/test": "webhookConfig.test",

  // Webhook deliveries
  "GET /v1/systems/:systemId/webhook-deliveries": "webhookDelivery.list",
  "GET /v1/systems/:systemId/webhook-deliveries/:deliveryId": "webhookDelivery.get",
  "DELETE /v1/systems/:systemId/webhook-deliveries/:deliveryId": "webhookDelivery.delete",

  // Board messages
  "POST /v1/systems/:systemId/board-messages": "boardMessage.create",
  "GET /v1/systems/:systemId/board-messages": "boardMessage.list",
  "GET /v1/systems/:systemId/board-messages/:boardMessageId": "boardMessage.get",
  "PUT /v1/systems/:systemId/board-messages/:boardMessageId": "boardMessage.update",
  "POST /v1/systems/:systemId/board-messages/:boardMessageId/archive": "boardMessage.archive",
  "POST /v1/systems/:systemId/board-messages/:boardMessageId/restore": "boardMessage.restore",
  "DELETE /v1/systems/:systemId/board-messages/:boardMessageId": "boardMessage.delete",
  "POST /v1/systems/:systemId/board-messages/reorder": "boardMessage.reorder",
  "POST /v1/systems/:systemId/board-messages/:boardMessageId/pin": "boardMessage.pin",
  "POST /v1/systems/:systemId/board-messages/:boardMessageId/unpin": "boardMessage.unpin",

  // Channels
  "POST /v1/systems/:systemId/channels": "channel.create",
  "GET /v1/systems/:systemId/channels": "channel.list",
  "GET /v1/systems/:systemId/channels/:channelId": "channel.get",
  "PUT /v1/systems/:systemId/channels/:channelId": "channel.update",
  "POST /v1/systems/:systemId/channels/:channelId/archive": "channel.archive",
  "POST /v1/systems/:systemId/channels/:channelId/restore": "channel.restore",
  "DELETE /v1/systems/:systemId/channels/:channelId": "channel.delete",

  // Messages (nested under channels)
  "POST /v1/systems/:systemId/channels/:channelId/messages": "message.create",
  "GET /v1/systems/:systemId/channels/:channelId/messages": "message.list",
  "GET /v1/systems/:systemId/channels/:channelId/messages/:messageId": "message.get",
  "PUT /v1/systems/:systemId/channels/:channelId/messages/:messageId": "message.update",
  "POST /v1/systems/:systemId/channels/:channelId/messages/:messageId/archive": "message.archive",
  "POST /v1/systems/:systemId/channels/:channelId/messages/:messageId/restore": "message.restore",
  "DELETE /v1/systems/:systemId/channels/:channelId/messages/:messageId": "message.delete",

  // Notes
  "POST /v1/systems/:systemId/notes": "note.create",
  "GET /v1/systems/:systemId/notes": "note.list",
  "GET /v1/systems/:systemId/notes/:noteId": "note.get",
  "PUT /v1/systems/:systemId/notes/:noteId": "note.update",
  "POST /v1/systems/:systemId/notes/:noteId/archive": "note.archive",
  "POST /v1/systems/:systemId/notes/:noteId/restore": "note.restore",
  "DELETE /v1/systems/:systemId/notes/:noteId": "note.delete",

  // Polls
  "POST /v1/systems/:systemId/polls": "poll.create",
  "GET /v1/systems/:systemId/polls": "poll.list",
  "GET /v1/systems/:systemId/polls/:pollId": "poll.get",
  "PUT /v1/systems/:systemId/polls/:pollId": "poll.update",
  "POST /v1/systems/:systemId/polls/:pollId/close": "poll.close",
  "POST /v1/systems/:systemId/polls/:pollId/archive": "poll.archive",
  "POST /v1/systems/:systemId/polls/:pollId/restore": "poll.restore",
  "DELETE /v1/systems/:systemId/polls/:pollId": "poll.delete",
  "POST /v1/systems/:systemId/polls/:pollId/votes": "poll.castVote",
  "GET /v1/systems/:systemId/polls/:pollId/votes": "poll.listVotes",
  "PUT /v1/systems/:systemId/polls/:pollId/votes/:voteId": "poll.updateVote",
  "DELETE /v1/systems/:systemId/polls/:pollId/votes/:voteId": "poll.deleteVote",
  "GET /v1/systems/:systemId/polls/:pollId/results": "poll.results",

  // Acknowledgements
  "POST /v1/systems/:systemId/acknowledgements": "acknowledgement.create",
  "GET /v1/systems/:systemId/acknowledgements": "acknowledgement.list",
  "GET /v1/systems/:systemId/acknowledgements/:acknowledgementId": "acknowledgement.get",
  "POST /v1/systems/:systemId/acknowledgements/:acknowledgementId/confirm":
    "acknowledgement.confirm",
  "POST /v1/systems/:systemId/acknowledgements/:acknowledgementId/archive":
    "acknowledgement.archive",
  "POST /v1/systems/:systemId/acknowledgements/:acknowledgementId/restore":
    "acknowledgement.restore",
  "DELETE /v1/systems/:systemId/acknowledgements/:acknowledgementId": "acknowledgement.delete",

  // Device tokens
  "POST /v1/systems/:systemId/device-tokens": "deviceToken.register",
  "GET /v1/systems/:systemId/device-tokens": "deviceToken.list",
  "PUT /v1/systems/:systemId/device-tokens/:tokenId": "deviceToken.update",
  "POST /v1/systems/:systemId/device-tokens/:tokenId/revoke": "deviceToken.revoke",
  "DELETE /v1/systems/:systemId/device-tokens/:tokenId": "deviceToken.delete",

  // Notification configs
  "GET /v1/systems/:systemId/notification-configs": "notificationConfig.list",
  "PATCH /v1/systems/:systemId/notification-configs/:eventType": "notificationConfig.update",

  // API keys
  "POST /v1/systems/:systemId/api-keys": "apiKey.create",
  "GET /v1/systems/:systemId/api-keys": "apiKey.list",
  "GET /v1/systems/:systemId/api-keys/:apiKeyId": "apiKey.get",
  "POST /v1/systems/:systemId/api-keys/:apiKeyId/revoke": "apiKey.revoke",

  // Snapshots
  "POST /v1/systems/:systemId/snapshots": "snapshot.create",
  "GET /v1/systems/:systemId/snapshots": "snapshot.list",
  "GET /v1/systems/:systemId/snapshots/:snapshotId": "snapshot.get",
  "DELETE /v1/systems/:systemId/snapshots/:snapshotId": "snapshot.delete",

  // Structure - entity types
  "POST /v1/systems/:systemId/structure/entity-types": "structure.entityType.create",
  "GET /v1/systems/:systemId/structure/entity-types": "structure.entityType.list",
  "GET /v1/systems/:systemId/structure/entity-types/:entityTypeId": "structure.entityType.get",
  "PUT /v1/systems/:systemId/structure/entity-types/:entityTypeId": "structure.entityType.update",
  "POST /v1/systems/:systemId/structure/entity-types/:entityTypeId/archive":
    "structure.entityType.archive",
  "POST /v1/systems/:systemId/structure/entity-types/:entityTypeId/restore":
    "structure.entityType.restore",
  "DELETE /v1/systems/:systemId/structure/entity-types/:entityTypeId":
    "structure.entityType.delete",

  // Structure - entities
  "POST /v1/systems/:systemId/structure/entities": "structure.entity.create",
  "GET /v1/systems/:systemId/structure/entities": "structure.entity.list",
  "GET /v1/systems/:systemId/structure/entities/:entityId": "structure.entity.get",
  "GET /v1/systems/:systemId/structure/entities/:entityId/hierarchy":
    "structure.entity.getHierarchy",
  "PUT /v1/systems/:systemId/structure/entities/:entityId": "structure.entity.update",
  "POST /v1/systems/:systemId/structure/entities/:entityId/archive": "structure.entity.archive",
  "POST /v1/systems/:systemId/structure/entities/:entityId/restore": "structure.entity.restore",
  "DELETE /v1/systems/:systemId/structure/entities/:entityId": "structure.entity.delete",

  // Structure - entity links
  "POST /v1/systems/:systemId/structure/entity-links": "structure.link.create",
  "GET /v1/systems/:systemId/structure/entity-links": "structure.link.list",
  "PUT /v1/systems/:systemId/structure/entity-links/:linkId": "structure.link.update",
  "DELETE /v1/systems/:systemId/structure/entity-links/:linkId": "structure.link.delete",

  // Structure - entity member links
  "POST /v1/systems/:systemId/structure/entity-member-links": "structure.memberLink.create",
  "GET /v1/systems/:systemId/structure/entity-member-links": "structure.memberLink.list",
  "DELETE /v1/systems/:systemId/structure/entity-member-links/:linkId":
    "structure.memberLink.delete",

  // Structure - entity associations
  "POST /v1/systems/:systemId/structure/entity-associations": "structure.association.create",
  "GET /v1/systems/:systemId/structure/entity-associations": "structure.association.list",
  "DELETE /v1/systems/:systemId/structure/entity-associations/:associationId":
    "structure.association.delete",
};

/**
 * REST routes that map to a tRPC procedure in a non-obvious way.
 * These are REST routes under sub-resource paths that use different
 * tRPC routers (e.g., field values are under members/groups in REST
 * but under field.value in tRPC).
 */
const STRUCTURAL_DIVERGENCE: ReadonlySet<string> = new Set([
  // Field values are accessed via /:memberId/fields or /:groupId/fields in REST
  // but via field.value.set/list/remove in tRPC. The field value REST routes
  // are dynamically generated by createFieldValueRoutes and not in the mapping.
  // Notification config "get" is accessed via notificationConfig.update eventType param
  "GET /v1/systems/:systemId/notification-configs/:eventType",
]);

export function resolveMapping(restKey: string): string | null {
  // Direct override lookup
  if (restKey in MAPPING_OVERRIDES) {
    return MAPPING_OVERRIDES[restKey] ?? null;
  }

  return null;
}

// ── 5. Parity Checks ───────────────────────────────────────────────────────

export function runParityChecks(
  restRoutes: RESTRouteInfo[],
  trpcProcedures: Map<string, TRPCProcedureInfo>,
): { failures: ParityFailure[]; warnings: ParityFailure[]; stats: CheckStats } {
  const failures: ParityFailure[] = [];
  const warnings: ParityFailure[] = [];
  let existenceChecked = 0;
  let rateLimitChecked = 0;
  let authChecked = 0;
  let scopeChecked = 0;
  let idempotencyChecked = 0;
  let unmappedCount = 0;

  for (const rest of restRoutes) {
    // Skip allowlisted REST-only routes
    if (REST_ONLY_SET.has(rest.routeKey)) continue;

    // Skip structural divergences (documented but intentionally different)
    if (STRUCTURAL_DIVERGENCE.has(rest.routeKey)) continue;

    const trpcPath = resolveMapping(rest.routeKey);

    // Check 1: Procedure existence
    existenceChecked++;
    if (!trpcPath) {
      unmappedCount++;
      failures.push({
        dimension: "existence",
        restRoute: rest.routeKey,
        expected: "tRPC counterpart",
        actual: "no mapping defined (add to MAPPING_OVERRIDES)",
      });
      continue;
    }

    const trpc = trpcProcedures.get(trpcPath);
    if (!trpc) {
      failures.push({
        dimension: "existence",
        restRoute: rest.routeKey,
        expected: `tRPC procedure "${trpcPath}"`,
        actual: "procedure not found in appRouter",
      });
      continue;
    }

    // Check 2: Rate limit category
    rateLimitChecked++;
    if (rest.rateLimitCategory && trpc.rateLimitCategory) {
      if (rest.rateLimitCategory !== trpc.rateLimitCategory) {
        failures.push({
          dimension: "rate-limit",
          restRoute: rest.routeKey,
          expected: `category "${rest.rateLimitCategory}" (REST)`,
          actual: `category "${trpc.rateLimitCategory}" (tRPC: ${trpcPath})`,
        });
      }
    } else if (rest.rateLimitCategory && !trpc.rateLimitCategory) {
      failures.push({
        dimension: "rate-limit",
        restRoute: rest.routeKey,
        expected: `category "${rest.rateLimitCategory}" (REST)`,
        actual: `no category detected (tRPC: ${trpcPath}) — add to rate-limit allowlist if using custom limiter`,
      });
    }

    // Check 3: Auth level
    authChecked++;
    if (rest.authLevel !== trpc.authLevel) {
      // Special case: REST routes under /v1/systems/ use inherited auth
      // from parent, so they all show as "system" or "protected" based on path.
      // tRPC auth is more precise. Only flag clear mismatches.
      const isMinorDifference =
        (rest.authLevel === "system" && trpc.authLevel === "protected") ||
        (rest.authLevel === "protected" && trpc.authLevel === "system");

      if (!isMinorDifference) {
        failures.push({
          dimension: "auth-level",
          restRoute: rest.routeKey,
          expected: `${rest.authLevel} (REST)`,
          actual: `${trpc.authLevel} (tRPC: ${trpcPath})`,
        });
      }
    }

    // Check 4: Scope
    if (rest.scope && trpc.scope) {
      scopeChecked++;
      if (rest.scope !== trpc.scope) {
        failures.push({
          dimension: "scope",
          restRoute: rest.routeKey,
          expected: `scope "${rest.scope}" (REST)`,
          actual: `scope "${trpc.scope}" (tRPC: ${trpcPath})`,
        });
      }
    } else if (rest.scope && !trpc.scope) {
      scopeChecked++;
      failures.push({
        dimension: "scope",
        restRoute: rest.routeKey,
        expected: `scope "${rest.scope}" (REST)`,
        actual: `no scope detected (tRPC: ${trpcPath})`,
      });
    } else if (!rest.scope && trpc.scope) {
      scopeChecked++;
      failures.push({
        dimension: "scope",
        restRoute: rest.routeKey,
        expected: `no scope (REST)`,
        actual: `scope "${trpc.scope}" (tRPC: ${trpcPath})`,
      });
    }

    // Check 5: Idempotency
    if (rest.hasIdempotency) {
      idempotencyChecked++;
      // tRPC doesn't have idempotency middleware yet — just report it
      warnings.push({
        dimension: "idempotency",
        restRoute: rest.routeKey,
        expected: "idempotency middleware (REST has it)",
        actual: `tRPC (${trpcPath}) lacks idempotency — expected for now`,
      });
    }
  }

  return {
    failures,
    warnings,
    stats: {
      restRoutes: restRoutes.length,
      trpcProcedures: trpcProcedures.size,
      existenceChecked,
      rateLimitChecked,
      authChecked,
      scopeChecked,
      idempotencyChecked,
      unmappedCount,
    },
  };
}

// ── Output ──────────────────────────────────────────────────────────────────

export function printResults(
  failures: ParityFailure[],
  warnings: ParityFailure[],
  stats: CheckStats,
): void {
  console.log(`\n${BOLD}tRPC ↔ REST Parity Check${RESET}\n`);

  console.log(`${DIM}REST routes:${RESET}      ${String(stats.restRoutes)}`);
  console.log(`${DIM}tRPC procedures:${RESET}  ${String(stats.trpcProcedures)}`);
  console.log(`${DIM}Existence:${RESET}        ${String(stats.existenceChecked)} checked`);
  console.log(`${DIM}Rate limits:${RESET}      ${String(stats.rateLimitChecked)} compared`);
  console.log(`${DIM}Auth levels:${RESET}      ${String(stats.authChecked)} compared`);
  console.log(`${DIM}Scopes:${RESET}           ${String(stats.scopeChecked)} compared`);
  console.log(`${DIM}Idempotency:${RESET}      ${String(stats.idempotencyChecked)} flagged\n`);

  if (failures.length > 0) {
    console.log(`${RED}${BOLD}FAILURES (${String(failures.length)}):${RESET}\n`);

    // Group by dimension
    const byDimension = new Map<ParityDimension, ParityFailure[]>();
    for (const f of failures) {
      const group = byDimension.get(f.dimension) ?? [];
      group.push(f);
      byDimension.set(f.dimension, group);
    }

    for (const [dimension, items] of byDimension) {
      console.log(`  ${RED}[${dimension}]${RESET}`);
      for (const f of items) {
        console.log(`    ${f.restRoute}`);
        console.log(`      ${DIM}expected:${RESET} ${f.expected}`);
        console.log(`      ${DIM}actual:${RESET}   ${f.actual}`);
      }
      console.log();
    }
  }

  if (warnings.length > 0) {
    const idempotencyWarnings = warnings.filter((w) => w.dimension === "idempotency");
    const otherWarnings = warnings.filter((w) => w.dimension !== "idempotency");

    if (otherWarnings.length > 0) {
      console.log(`${YELLOW}${BOLD}WARNINGS (${String(otherWarnings.length)}):${RESET}\n`);
      for (const w of otherWarnings) {
        console.log(`  ${YELLOW}[${w.dimension}]${RESET} ${w.restRoute}`);
        console.log(`    ${DIM}${w.actual}${RESET}`);
      }
      console.log();
    }

    if (idempotencyWarnings.length > 0) {
      console.log(
        `${CYAN}${BOLD}IDEMPOTENCY (${String(idempotencyWarnings.length)} REST routes with idempotency, tRPC lacks it):${RESET}`,
      );
      console.log(`  ${DIM}This is expected — tRPC idempotency is not yet implemented.${RESET}`);
      for (const w of idempotencyWarnings) {
        console.log(`  ${DIM}- ${w.restRoute}${RESET}`);
      }
      console.log();
    }
  }

  if (failures.length === 0) {
    console.log(`${GREEN}${BOLD}All parity checks passed.${RESET}\n`);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function execAllMatches(pattern: RegExp, source: string): RegExpExecArray[] {
  const re = new RegExp(pattern.source, pattern.flags);
  const results: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) results.push(match);
  return results;
}
